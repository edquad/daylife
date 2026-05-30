# Rozka — connect your personal AWS account (run once on your PC)
# Prerequisites: AWS CLI installed — https://aws.amazon.com/cli/

Write-Host "=== Rozka AWS connect ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Your AWS account: anshul kumar (175616157827)"
Write-Host "Free credits: ~`$119 until Sep 2026 — push relay uses pennies/month."
Write-Host ""
Write-Host "STEP 1 — AWS Console (browser)"
Write-Host "  1. IAM -> Users -> Create user: rozka-github"
Write-Host "  2. Attach policy from file: aws/iam-rozka-deploy-policy.json"
Write-Host "  3. Create access key -> CLI -> copy Access Key ID + Secret"
Write-Host ""
Write-Host "STEP 2 — This PC (PowerShell)"
Write-Host "  aws configure"
Write-Host "  Region: ap-south-1  (or your preferred region)"
Write-Host ""
Write-Host "STEP 3 — GitHub repo edquad/daylife -> Settings -> Secrets and variables"
Write-Host "  Secrets:"
Write-Host "    AWS_ACCESS_KEY_ID"
Write-Host "    AWS_SECRET_ACCESS_KEY"
Write-Host "    DAYLIFE_VAPID_PRIVATE_KEY  (keep secret, never commit)"
Write-Host "  Variables:"
Write-Host "    AWS_REGION = ap-south-1"
Write-Host ""
Write-Host "STEP 4 — Deploy push relay locally (optional test):"
Write-Host '  cd aws/push-relay; npm install; cd ..'
Write-Host '  sam build; sam deploy --guided'
Write-Host ""
Write-Host "STEP 5 — GitHub Actions -> Deploy AWS push relay -> Run workflow"
Write-Host "  Copy output PushRelayUrl -> repo Variable DAYLIFE_PUSH_RELAY_URL"
Write-Host "  Re-run Deploy to GitHub Pages (or push to main)"
Write-Host ""

if (Get-Command aws -ErrorAction SilentlyContinue) {
  Write-Host "Checking AWS identity..." -ForegroundColor Yellow
  aws sts get-caller-identity 2>$null
  if ($LASTEXITCODE -eq 0) {
    Write-Host "AWS CLI is configured." -ForegroundColor Green
  } else {
    Write-Host "Run: aws configure" -ForegroundColor Red
  }
} else {
  Write-Host "Install AWS CLI first: winget install Amazon.AWSCLI" -ForegroundColor Red
}
