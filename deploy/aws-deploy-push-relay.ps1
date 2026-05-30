# Deploy Rozka push relay to YOUR AWS account (anshul — 175616157827)
# Requires: AWS CLI configured with IAM user on account 175616157827

$ErrorActionPreference = "Stop"
$ExpectedAccount = "175616157827"
$Region = if ($env:AWS_REGION) { $env:AWS_REGION } else { "ap-south-1" }
$StackName = "rozka-push-relay"
$Root = Split-Path $PSScriptRoot -Parent
$PushDir = Join-Path $Root "aws\push-relay"
$Template = Join-Path $Root "aws\template.yaml"

Write-Host "=== Rozka AWS deploy ===" -ForegroundColor Cyan

if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
  Write-Host "Install AWS CLI: winget install Amazon.AWSCLI" -ForegroundColor Red
  exit 1
}

$env:AWS_DEFAULT_REGION = $Region
$identity = aws sts get-caller-identity --output json | ConvertFrom-Json
Write-Host "Logged in as: $($identity.Arn)"
Write-Host "Account: $($identity.Account)"

if ($identity.Account -ne $ExpectedAccount) {
  Write-Host ""
  Write-Host "WRONG AWS ACCOUNT." -ForegroundColor Red
  Write-Host "Expected anshul account: $ExpectedAccount"
  Write-Host "Current account: $($identity.Account)"
  Write-Host ""
  Write-Host "Fix: aws configure  (use IAM keys from account $ExpectedAccount)"
  Write-Host "Or:  aws configure --profile anshul-rozka"
  Write-Host "Then: `$env:AWS_PROFILE='anshul-rozka'; .\deploy\aws-deploy-push-relay.ps1"
  exit 1
}

$vapidPublic = "BET8I04xeWID8z61Rv6Mj7n-j7jF1rZgYmSOlLFHaZx9Yw29eiahe7IfAudP6OhbW8DuGhks21Z8j9BcvHHYF5g"
$vapidPrivate = $env:DAYLIFE_VAPID_PRIVATE_KEY
if (-not $vapidPrivate) {
  Write-Host "Set VAPID private key first (PowerShell):" -ForegroundColor Yellow
  Write-Host '  $env:DAYLIFE_VAPID_PRIVATE_KEY = "your-private-key"'
  Write-Host "Do not paste keys in chat. Use the key from project setup."
  exit 1
}

Write-Host "Installing Lambda dependencies..." -ForegroundColor Yellow
Push-Location $PushDir
npm install --omit=dev 2>$null
if (-not $?) { npm install }
Pop-Location

if (Get-Command sam -ErrorAction SilentlyContinue) {
  Write-Host "Deploying with SAM..." -ForegroundColor Yellow
  Push-Location (Join-Path $Root "aws")
  sam build
  sam deploy --stack-name $StackName --resolve-s3 --capabilities CAPABILITY_IAM --no-confirm-changeset `
    --parameter-overrides "VapidPublicKey=$vapidPublic VapidPrivateKey=$vapidPrivate"
  $url = aws cloudformation describe-stacks --stack-name $StackName `
    --query "Stacks[0].Outputs[?OutputKey=='PushRelayUrl'].OutputValue" --output text
  Pop-Location
} else {
  Write-Host "SAM CLI not found. Install: winget install Amazon.SAM-CLI" -ForegroundColor Yellow
  Write-Host "Or add GitHub secrets and run Actions workflow: Deploy AWS push relay"
  exit 1
}

Write-Host ""
Write-Host "SUCCESS" -ForegroundColor Green
Write-Host "Push relay URL: $url"
Write-Host ""
Write-Host "Next: GitHub repo edquad/daylife -> Settings -> Variables"
Write-Host "  DAYLIFE_PUSH_RELAY_URL = $url"
Write-Host "Then redeploy GitHub Pages (push to main or run Deploy workflow)."
