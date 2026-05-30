# Deploy Rozka multi-user Gmail drafts — secrets live in AWS Secrets Manager only
param(
  [string]$GoogleClientId = $env:GOOGLE_CLIENT_ID,
  [string]$GoogleClientSecret = $env:GOOGLE_CLIENT_SECRET,
  [string]$TokenSecret = $env:GMAIL_TOKEN_SECRET,
  [string]$SecretName = "rozka/gmail-drafts",
  [string]$ExpectedAccount = "175616157827",
  [string]$Region = "ap-south-1",
  [string]$ApiName = "rozka-push-relay",
  [string]$Profile = "anshul-rozka"
)

$ErrorActionPreference = "Stop"
$env:AWS_PROFILE = $Profile
$env:AWS_DEFAULT_REGION = $Region
$Root = Split-Path $PSScriptRoot -Parent
$FnDir = Join-Path $Root "aws\gmail-drafts"
$FnName = "rozka-gmail-drafts"
$RoleName = "rozka-gmail-drafts-role"
$BucketName = "rozka-gmail-tokens-$ExpectedAccount"
$SecretsBucket = "rozka-app-secrets-$ExpectedAccount"
$SecretsS3Key = "config/gmail-drafts.json"
$TrustFile = (Join-Path $Root "aws\lambda-trust-policy.json") -replace '\\', '/'
$PolicyFile = (Join-Path $Root "aws\gmail-drafts-policy.json") -replace '\\', '/'

if (-not $GoogleClientId -or -not $GoogleClientSecret) {
  Write-Host "Pass Google OAuth once (stored in AWS Secrets Manager, not in code):" -ForegroundColor Yellow
  Write-Host '  $env:GOOGLE_CLIENT_ID = "....apps.googleusercontent.com"'
  Write-Host '  $env:GOOGLE_CLIENT_SECRET = "...."'
  Write-Host "  .\deploy\aws-deploy-gmail-drafts.ps1"
  exit 1
}

if (-not $TokenSecret -or $TokenSecret.Length -lt 16) {
  $TokenSecret = -join ((48..57 + 65..90 + 97..122) | Get-Random -Count 32 | ForEach-Object { [char]$_ })
  Write-Host "Generated gmailTokenSecret (stored in AWS Secrets Manager only)." -ForegroundColor Gray
}

$identity = aws sts get-caller-identity --output json | ConvertFrom-Json
if ($identity.Account -ne $ExpectedAccount) {
  Write-Host "Wrong AWS account" -ForegroundColor Red
  exit 1
}

$apisJson = aws apigatewayv2 get-apis --region $Region --output json | ConvertFrom-Json
$apiId = ($apisJson.Items | Where-Object { $_.Name -eq $ApiName } | Select-Object -First 1).ApiId
if (-not $apiId) {
  Write-Host "Deploy push relay first (API $ApiName not found)" -ForegroundColor Red
  exit 1
}

$redirectUri = "https://${apiId}.execute-api.${Region}.amazonaws.com/gmail/auth/callback"
$apiBase = "https://${apiId}.execute-api.${Region}.amazonaws.com"

Write-Host "=== Rozka Gmail drafts deploy ===" -ForegroundColor Cyan
Write-Host "Secrets: AWS Secrets Manager -> $SecretName"
Write-Host "API base: $apiBase"

$secretPayload = @{
  googleClientId = $GoogleClientId
  googleClientSecret = $GoogleClientSecret
  gmailTokenSecret = $TokenSecret
} | ConvertTo-Json -Compress

$secretFile = Join-Path $env:TEMP "rozka-gmail-secret.json"
[System.IO.File]::WriteAllText($secretFile, $secretPayload)

$prevEap = $ErrorActionPreference
$ErrorActionPreference = 'SilentlyContinue'
aws secretsmanager create-secret --name $SecretName --secret-string "file://$secretFile" --region $Region 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
  aws secretsmanager put-secret-value --secret-id $SecretName --secret-string "file://$secretFile" --region $Region 2>$null | Out-Null
}
if ($LASTEXITCODE -eq 0) {
  Write-Host "AWS Secrets Manager updated: $SecretName" -ForegroundColor Green
} else {
  aws s3api create-bucket --bucket $SecretsBucket --region $Region --create-bucket-configuration LocationConstraint=$Region 2>$null | Out-Null
  aws s3api put-public-access-block --bucket $SecretsBucket --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true 2>$null | Out-Null
  aws s3 cp $secretFile "s3://$SecretsBucket/$SecretsS3Key" --region $Region --sse AES256 | Out-Null
  if ($LASTEXITCODE -ne 0) {
    $ErrorActionPreference = $prevEap
    Write-Host "Could not store secrets (Secrets Manager or S3)" -ForegroundColor Red
    exit 1
  }
  Write-Host "Secrets stored in private S3 (encrypted): s3://$SecretsBucket/$SecretsS3Key" -ForegroundColor Green
  Write-Host "Attach iam-rozka-secrets-policy.json later to use Secrets Manager instead." -ForegroundColor Yellow
}
$ErrorActionPreference = $prevEap

$ErrorActionPreference = 'SilentlyContinue'
aws s3api create-bucket --bucket $BucketName --region $Region --create-bucket-configuration LocationConstraint=$Region 2>$null | Out-Null
aws s3api put-public-access-block --bucket $BucketName --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true 2>$null | Out-Null
$ErrorActionPreference = $prevEap

$ErrorActionPreference = 'SilentlyContinue'
aws iam create-role --role-name $RoleName --assume-role-policy-document "file://$TrustFile" 2>$null | Out-Null
$ErrorActionPreference = $prevEap
aws iam get-role --role-name $RoleName | Out-Null
aws iam attach-role-policy --role-name $RoleName --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole 2>$null | Out-Null
aws iam put-role-policy --role-name $RoleName --policy-name RozkaGmailDrafts --policy-document "file://$PolicyFile" | Out-Null
Start-Sleep -Seconds 8

Push-Location $FnDir
npm install --omit=dev
Pop-Location

$zipPath = Join-Path $Root "aws\gmail-drafts.zip"
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
Compress-Archive -Path "$FnDir\index.js", "$FnDir\lib", "$FnDir\node_modules", "$FnDir\package.json" -DestinationPath $zipPath

$envFile = Join-Path $env:TEMP "rozka-gmail-env.json"
$envJson = @"
{
  "Variables": {
    "ROZKA_SECRETS_NAME": "$SecretName",
    "ROZKA_SECRETS_S3_BUCKET": "$SecretsBucket",
    "ROZKA_SECRETS_S3_KEY": "$SecretsS3Key",
    "GOOGLE_REDIRECT_URI": "$redirectUri",
    "GMAIL_TOKEN_BUCKET": "$BucketName",
    "APP_ORIGIN": "https://edquad.github.io",
    "BEDROCK_MODEL_ID": "amazon.nova-lite-v1:0",
    "GMAIL_MAX_DRAFTS_PER_RUN": "5"
  }
}
"@
[System.IO.File]::WriteAllText($envFile, $envJson)

$RoleArn = "arn:aws:iam::${ExpectedAccount}:role/$RoleName"
$fnExists = $false
$ErrorActionPreference = 'SilentlyContinue'
aws lambda get-function --function-name $FnName --region $Region 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) { $fnExists = $true }
$ErrorActionPreference = $prevEap

if (-not $fnExists) {
  aws lambda create-function --function-name $FnName --runtime nodejs20.x --role $RoleArn --handler index.handler `
    --zip-file "fileb://$zipPath" --timeout 120 --memory-size 512 --environment "file://$envFile" --region $Region | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "lambda create-function failed" }
} else {
  aws lambda update-function-code --function-name $FnName --zip-file "fileb://$zipPath" --region $Region | Out-Null
  Start-Sleep -Seconds 8
  aws lambda update-function-configuration --function-name $FnName --timeout 120 --memory-size 512 --environment "file://$envFile" --region $Region | Out-Null
}
aws lambda wait function-active --function-name $FnName --region $Region

$FnArn = aws lambda get-function --function-name $FnName --region $Region --query "Configuration.FunctionArn" --output text
$integrationsJson = aws apigatewayv2 get-integrations --api-id $apiId --region $Region --output json | ConvertFrom-Json
$intId = ($integrationsJson.Items | Where-Object { $_.IntegrationUri -eq $FnArn } | Select-Object -First 1).IntegrationId
if (-not $intId) {
  $intId = aws apigatewayv2 create-integration --api-id $apiId --integration-type AWS_PROXY --integration-uri $FnArn `
    --payload-format-version 2.0 --region $Region --query IntegrationId --output text
}

$routes = @(
  "GET /gmail/auth/start",
  "GET /gmail/auth/callback",
  "GET /gmail/status",
  "POST /gmail/disconnect",
  "POST /gmail/process",
  "OPTIONS /gmail/auth/start",
  "OPTIONS /gmail/status",
  "OPTIONS /gmail/disconnect",
  "OPTIONS /gmail/process"
)
$existing = aws apigatewayv2 get-routes --api-id $apiId --region $Region --query "Items[].RouteKey" --output text
foreach ($route in $routes) {
  if ($existing -notmatch [regex]::Escape($route)) {
    aws apigatewayv2 create-route --api-id $apiId --route-key $route --target "integrations/$intId" --region $Region | Out-Null
  }
}

$permId = "apigateway-gmail-" + (Get-Random)
aws lambda add-permission --function-name $FnName --statement-id $permId `
  --action lambda:InvokeFunction --principal apigateway.amazonaws.com `
  --source-arn "arn:aws:execute-api:${Region}:${ExpectedAccount}:${apiId}/*/*" --region $Region 2>$null | Out-Null

Write-Host ""
Write-Host "SUCCESS" -ForegroundColor Green
Write-Host "Secrets stored in: AWS Secrets Manager -> $SecretName"
Write-Host "Gmail API URL: $apiBase"
Write-Host "No secrets were saved to git or Lambda environment variables."
