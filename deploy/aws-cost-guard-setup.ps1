# Rozka AWS auto-pause at bill cap
param(
  [switch]$Resume,
  [switch]$Check,
  [string]$MonthlyCap = "10",
  [string]$ScheduleStack = "rozka-cost-guard-schedule",
  [string]$BillingRegion = "us-east-1",
  [string]$PauseRegion = "ap-south-1",
  [string]$ExpectedAccount = "175616157827",
  [string]$Profile = "anshul-rozka"
)

$ErrorActionPreference = "Stop"
$env:AWS_PROFILE = $Profile
$Root = Split-Path $PSScriptRoot -Parent
$DeployDir = $PSScriptRoot
$GuardDir = Join-Path $Root "aws\cost-guard"
$FunctionName = "rozka-cost-guard"
$RoleName = "rozka-cost-guard-role"

function Invoke-Aws([string[]]$CommandArgs) {
  $output = & aws @CommandArgs 2>&1
  if ($LASTEXITCODE -ne 0) { throw ($output | Out-String) }
  return ($output | Out-String).Trim()
}

$identity = (Invoke-Aws @("sts", "get-caller-identity", "--output", "json") | ConvertFrom-Json)
Write-Host "Account: $($identity.Account)" -ForegroundColor Cyan
if ($identity.Account -ne $ExpectedAccount) {
  Write-Host "Wrong account. Use profile $Profile" -ForegroundColor Red
  exit 1
}

if ($Resume) {
  $out = Join-Path $env:TEMP "rozka-resume.json"
  Invoke-Aws @("lambda", "invoke", "--function-name", $FunctionName, "--payload", '{"action":"resume"}', "--cli-binary-format", "raw-in-base64-out", $out, "--region", $BillingRegion) | Out-Null
  aws lambda delete-function-concurrency --function-name rozka-voice-parse --region $PauseRegion 2>$null
  aws lambda delete-function-concurrency --function-name rozka-push-relay --region $PauseRegion 2>$null
  Get-Content $out
  Write-Host "Resumed voice and push." -ForegroundColor Green
  exit 0
}

if ($Check) {
  $out = Join-Path $env:TEMP "rozka-check.json"
  Invoke-Aws @("lambda", "invoke", "--function-name", $FunctionName, "--payload", '{"action":"check"}', "--cli-binary-format", "raw-in-base64-out", $out, "--region", $BillingRegion) | Out-Null
  Get-Content $out
  exit 0
}

Write-Host "=== Rozka auto-pause at $MonthlyCap USD ===" -ForegroundColor Cyan

$trustFile = Join-Path $DeployDir "cost-guard-trust.json"
$policyFile = Join-Path $DeployDir "cost-guard-lambda-policy.json"
$prevEap = $ErrorActionPreference
$ErrorActionPreference = 'SilentlyContinue'
aws iam create-role --role-name $RoleName --assume-role-policy-document "file://$trustFile" 2>$null | Out-Null
$ErrorActionPreference = $prevEap
Invoke-Aws @("iam", "put-role-policy", "--role-name", $RoleName, "--policy-name", "rozka-cost-guard", "--policy-document", "file://$policyFile") | Out-Null
Start-Sleep -Seconds 8
$roleArn = Invoke-Aws @("iam", "get-role", "--role-name", $RoleName, "--query", "Role.Arn", "--output", "text")

Push-Location $GuardDir
npm install --omit=dev 2>$null; if ($LASTEXITCODE -ne 0) { npm install }
Pop-Location

$zipPath = Join-Path $Root "aws\cost-guard.zip"
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
Compress-Archive -Path "$GuardDir\index.js", "$GuardDir\package.json", "$GuardDir\node_modules" -DestinationPath $zipPath

$envFile = Join-Path $DeployDir "cost-guard-env.json"
$envJson = @"
{
  "Variables": {
    "PAUSE_REGION": "$PauseRegion",
    "BILLING_REGION": "$BillingRegion",
    "PAUSE_FUNCTIONS": "rozka-voice-parse,rozka-push-relay",
    "MONTHLY_CAP_USD": "$MonthlyCap"
  }
}
"@
[System.IO.File]::WriteAllText($envFile, $envJson)

$fnExists = $true
try { Invoke-Aws @("lambda", "get-function", "--function-name", $FunctionName, "--region", $BillingRegion) | Out-Null } catch { $fnExists = $false }

if (-not $fnExists) {
  Invoke-Aws @("lambda", "create-function", "--function-name", $FunctionName, "--runtime", "nodejs20.x", "--role", $roleArn, "--handler", "index.handler", "--zip-file", "fileb://$zipPath", "--timeout", "30", "--environment", "file://$envFile", "--region", $BillingRegion) | Out-Null
} else {
  Invoke-Aws @("lambda", "update-function-code", "--function-name", $FunctionName, "--zip-file", "fileb://$zipPath", "--region", $BillingRegion) | Out-Null
  Start-Sleep -Seconds 5
  Invoke-Aws @("lambda", "update-function-configuration", "--function-name", $FunctionName, "--environment", "file://$envFile", "--region", $BillingRegion) | Out-Null
}

$scheduleTemplate = Join-Path $DeployDir "cost-guard-schedule.yaml"
$scheduleOk = $true
$stackStatus = ""
$ErrorActionPreference = 'SilentlyContinue'
$stackStatus = aws cloudformation describe-stacks --stack-name $ScheduleStack --region $BillingRegion --query "Stacks[0].StackStatus" --output text 2>$null
$ErrorActionPreference = 'Stop'

if ($stackStatus -eq "ROLLBACK_COMPLETE") {
  aws cloudformation delete-stack --stack-name $ScheduleStack --region $BillingRegion | Out-Null
  aws cloudformation wait stack-delete-complete --stack-name $ScheduleStack --region $BillingRegion
  $stackStatus = ""
}

if ($stackStatus -eq "CREATE_COMPLETE" -or $stackStatus -eq "UPDATE_COMPLETE") {
  aws cloudformation update-stack --stack-name $ScheduleStack --template-body "file://$scheduleTemplate" --region $BillingRegion 2>$null | Out-Null
} else {
  Invoke-Aws @("cloudformation", "create-stack", "--stack-name", $ScheduleStack, "--template-body", "file://$scheduleTemplate", "--region", $BillingRegion) | Out-Null
  $waitResult = aws cloudformation wait stack-create-complete --stack-name $ScheduleStack --region $BillingRegion 2>&1
  if ($LASTEXITCODE -ne 0) {
    $scheduleOk = $false
    Write-Host "Schedule stack failed (needs EventBridge IAM on rozka-github)." -ForegroundColor Yellow
    Write-Host "Add the 6-hour trigger manually - see instructions below." -ForegroundColor Yellow
  }
}

if ($scheduleOk) {
  Write-Host ""
  Write-Host "SUCCESS - auto-pause is live." -ForegroundColor Green
} else {
  Write-Host ""
  Write-Host "PARTIAL - cost guard Lambda is live; add schedule trigger in console." -ForegroundColor Yellow
}
Write-Host "Checks billing every 6 hours; pauses voice + push at $MonthlyCap USD."
Write-Host ""
Write-Host "Manual schedule (2 min, as account owner):" -ForegroundColor Cyan
Write-Host "  Lambda -> rozka-cost-guard (region us-east-1) -> Add trigger"
Write-Host "  EventBridge schedule -> rate(6 hours) -> payload: {\"action\":\"check\"}"
Write-Host ""
Write-Host 'Resume: .\deploy\aws-cost-guard-setup.ps1 -Resume'
Write-Host 'Check:  .\deploy\aws-cost-guard-setup.ps1 -Check'
