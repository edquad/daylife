# Deploy Rozka voice AI (Bedrock) to anshul AWS account 175616157827
$ErrorActionPreference = "Stop"
$ExpectedAccount = "175616157827"
$Region = if ($env:AWS_REGION) { $env:AWS_REGION } else { "ap-south-1" }
$Root = Split-Path $PSScriptRoot -Parent
$VoiceDir = Join-Path $Root "aws\voice-parse"
$PolicyFile = (Join-Path $Root "aws\voice-parse-bedrock-policy.json") -replace '\\', '/'
$RoleName = "rozka-voice-parse-lambda"
$FnName = "rozka-voice-parse"
$ApiName = "rozka-push-relay"
$TrustFile = (Join-Path $Root "aws\lambda-trust-policy.json") -replace '\\', '/'

Write-Host "=== Rozka voice AI deploy ===" -ForegroundColor Cyan
$env:AWS_DEFAULT_REGION = $Region
$identity = aws sts get-caller-identity --output json | ConvertFrom-Json
if ($identity.Account -ne $ExpectedAccount) {
  Write-Host "Wrong AWS account: $($identity.Account) (expected $ExpectedAccount)" -ForegroundColor Red
  exit 1
}

$roleExists = $true
try { aws iam get-role --role-name $RoleName | Out-Null } catch { $roleExists = $false }
if (-not $roleExists) {
  aws iam create-role --role-name $RoleName --assume-role-policy-document "file://$TrustFile"
}
aws iam attach-role-policy --role-name $RoleName --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole 2>$null
aws iam put-role-policy --role-name $RoleName --policy-name RozkaVoiceBedrock --policy-document "file://$PolicyFile"

Start-Sleep -Seconds 5
Push-Location $VoiceDir
npm install --omit=dev
Pop-Location

$zipPath = Join-Path $Root "aws\voice-parse.zip"
if (Test-Path $zipPath) { Remove-Item $zipPath }
Compress-Archive -Path "$VoiceDir\*" -DestinationPath $zipPath -Force

$RoleArn = "arn:aws:iam::$($ExpectedAccount):role/$RoleName"
$fnExists = $true
try { aws lambda get-function --function-name $FnName | Out-Null } catch { $fnExists = $false }
if (-not $fnExists) {
  aws lambda create-function --function-name $FnName --runtime nodejs20.x --role $RoleArn --handler index.handler `
    --zip-file "fileb://$zipPath" --timeout 20 --memory-size 256 `
    --environment "Variables={BEDROCK_MODEL_IDS=amazon.nova-lite-v1:0,amazon.nova-micro-v1:0}"
} else {
  aws lambda update-function-code --function-name $FnName --zip-file "fileb://$zipPath"
  aws lambda update-function-configuration --function-name $FnName --timeout 20 --memory-size 256 `
    --environment "Variables={BEDROCK_MODEL_IDS=amazon.nova-lite-v1:0,amazon.nova-micro-v1:0}"
}
aws lambda wait function-active --function-name $FnName

$apisJson = aws apigatewayv2 get-apis --output json | ConvertFrom-Json
$apiId = ($apisJson.Items | Where-Object { $_.Name -eq $ApiName } | Select-Object -First 1).ApiId
if (-not $apiId) {
  Write-Host "API $ApiName not found. Deploy push relay first." -ForegroundColor Red
  exit 1
}

$FnArn = aws lambda get-function --function-name $FnName --query "Configuration.FunctionArn" --output text
$integrationsJson = aws apigatewayv2 get-integrations --api-id $apiId --output json | ConvertFrom-Json
$intId = ($integrationsJson.Items | Where-Object { $_.IntegrationUri -eq $FnArn } | Select-Object -First 1).IntegrationId
if (-not $intId) {
  $intId = aws apigatewayv2 create-integration --api-id $apiId --integration-type AWS_PROXY --integration-uri $FnArn `
    --payload-format-version 2.0 --query IntegrationId --output text
}

$routesText = aws apigatewayv2 get-routes --api-id $apiId --query "Items[].RouteKey" --output text
if ($routesText -notmatch "POST /voice/parse") {
  aws apigatewayv2 create-route --api-id $apiId --route-key "POST /voice/parse" --target "integrations/$intId" | Out-Null
}
if ($routesText -notmatch "OPTIONS /voice/parse") {
  aws apigatewayv2 create-route --api-id $apiId --route-key "OPTIONS /voice/parse" --target "integrations/$intId" | Out-Null
}

$permId = "apigateway-voice-" + (Get-Random)
aws lambda add-permission --function-name $FnName --statement-id $permId `
  --action lambda:InvokeFunction --principal apigateway.amazonaws.com `
  --source-arn "arn:aws:execute-api:${Region}:${ExpectedAccount}:${apiId}/*/*/voice/parse" 2>$null

$url = "https://${apiId}.execute-api.${Region}.amazonaws.com/voice/parse"
Write-Host ""
Write-Host "SUCCESS" -ForegroundColor Green
Write-Host "Voice parse URL: $url"
Write-Host "Set GitHub variable DAYLIFE_VOICE_PARSE_URL to the URL above"
Write-Host "Enable Amazon Nova in Bedrock console (Model access) once if needed"
