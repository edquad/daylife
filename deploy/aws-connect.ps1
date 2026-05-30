# Rozka - connect your personal AWS account (run once on your PC)

Write-Host "=== Rozka AWS connect ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Your AWS account: anshul kumar (175616157827)"
Write-Host "Free credits until Sep 2026. Push relay uses pennies per month."
Write-Host ""
Write-Host "STEP 1 - AWS Console (browser)"
Write-Host "  1. IAM -> Users -> Create user: rozka-github"
Write-Host "  2. Attach policy from file: aws/iam-rozka-deploy-policy.json"
Write-Host "  3. Create access key -> CLI -> copy Access Key ID + Secret"
Write-Host ""
Write-Host "STEP 2 - This PC (PowerShell)"
Write-Host "  .\deploy\anshul-aws-setup.ps1"
Write-Host ""
Write-Host "STEP 3 - GitHub repo edquad/daylife -> Settings -> Secrets and variables"
Write-Host "  Secrets: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, DAYLIFE_VAPID_PRIVATE_KEY"
Write-Host "  Variable: AWS_REGION = ap-south-1"
Write-Host ""

if (Get-Command aws -ErrorAction SilentlyContinue) {
  Write-Host "Checking AWS identity..." -ForegroundColor Yellow
  aws sts get-caller-identity 2>$null
  if ($LASTEXITCODE -eq 0) {
    Write-Host "AWS CLI is configured." -ForegroundColor Green
  } else {
    Write-Host "Run: .\deploy\anshul-aws-setup.ps1" -ForegroundColor Red
  }
} else {
  Write-Host "Install AWS CLI first: winget install Amazon.AWSCLI" -ForegroundColor Red
}
