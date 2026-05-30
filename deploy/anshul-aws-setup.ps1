# One-time: connect CLI to anshul AWS (175616157827) and deploy Rozka push relay
$ErrorActionPreference = "Stop"
$Profile = "anshul-rozka"
$ExpectedAccount = "175616157827"
$Region = "ap-south-1"

Write-Host ""
Write-Host "=== Rozka + anshul AWS ($ExpectedAccount) ===" -ForegroundColor Cyan
Write-Host "Free credits cover this. Region: $Region"
Write-Host ""
Write-Host "Get keys: AWS Console -> IAM -> rozka-github user -> Access keys"
Write-Host "Create user first if needed. Policy file: aws/iam-rozka-deploy-policy.json"
Write-Host ""

$accessKey = Read-Host "Paste Access Key ID"
$secretKey = Read-Host "Paste Secret Access Key" -AsSecureString
$plainSecret = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
  [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secretKey)
)

aws configure set aws_access_key_id $accessKey --profile $Profile
aws configure set aws_secret_access_key $plainSecret --profile $Profile
aws configure set region $Region --profile $Profile
aws configure set output json --profile $Profile

$env:AWS_PROFILE = $Profile
$env:AWS_DEFAULT_REGION = $Region
$plainSecret = $null

$identity = aws sts get-caller-identity --output json | ConvertFrom-Json
Write-Host ""
Write-Host "Connected: $($identity.Arn)" -ForegroundColor Green

if ($identity.Account -ne $ExpectedAccount) {
  Write-Host "Wrong account! Expected $ExpectedAccount got $($identity.Account)" -ForegroundColor Red
  exit 1
}

$vapidPrivate = Read-Host "Paste VAPID private key (or press Enter to skip deploy)"
if ($vapidPrivate) {
  $env:DAYLIFE_VAPID_PRIVATE_KEY = $vapidPrivate
  & (Join-Path $PSScriptRoot "aws-deploy-push-relay.ps1")
} else {
  Write-Host ""
  Write-Host "Profile saved. To deploy later:" -ForegroundColor Yellow
  Write-Host ('  $env:AWS_PROFILE=' + "'$Profile'")
  Write-Host '  $env:DAYLIFE_VAPID_PRIVATE_KEY = "your-key-here"'
  Write-Host "  .\deploy\aws-deploy-push-relay.ps1"
}

Write-Host ""
Write-Host "Add same keys to GitHub repo edquad/daylife Secrets:" -ForegroundColor Cyan
Write-Host "  AWS_ACCESS_KEY_ID"
Write-Host "  AWS_SECRET_ACCESS_KEY"
Write-Host "  DAYLIFE_VAPID_PRIVATE_KEY"
Write-Host "Variable: AWS_REGION = ap-south-1"
