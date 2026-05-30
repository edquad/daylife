# Gmail AI drafts — setup

Multi-user: each Rozka user connects **their own** Gmail in Settings.

## Behavior

- **Draft only** — AI writes to Gmail Drafts; user sends manually
- **Human messages only** — skips noreply, newsletters, receipts, bots
- Tokens encrypted in S3 per cloud `accountId`

## 1. Google Cloud (one-time, app owner)

1. [Google Cloud Console](https://console.cloud.google.com/) → create/select project
2. **APIs & Services → Enable APIs** → enable **Gmail API**
3. **OAuth consent screen** → External → add app name **Rozka AI**
   - Scopes: `gmail.readonly`, `gmail.compose`
   - While **Testing**, add each test user email (or publish app later)
4. **Credentials → Create OAuth client → Web application**
   - Authorized redirect URI (after AWS deploy):
     `https://vmqudc9i2l.execute-api.ap-south-1.amazonaws.com/gmail/auth/callback`

## 2. Deploy AWS Lambda (secrets go to AWS Secrets Manager only)

Run once on your PC — credentials are **not** saved in code or git:

```powershell
cd c:\Users\varun\Desktop\project\fati\daylife
$env:AWS_PROFILE = 'anshul-rozka'
$env:GOOGLE_CLIENT_ID = '....apps.googleusercontent.com'
$env:GOOGLE_CLIENT_SECRET = '....'
.\deploy\aws-deploy-gmail-drafts.ps1
```

The script stores everything in **AWS Secrets Manager** (`rozka/gmail-drafts`).  
Lambda reads secrets at runtime — nothing sensitive in environment variables or repo.

To rotate Google credentials later, update the secret in AWS Console → Secrets Manager.

## 3. GitHub repo variable

Repo **edquad/daylife** → Settings → Secrets and variables → Actions → Variables:

| Name | Value |
|------|--------|
| `DAYLIFE_GMAIL_API_URL` | `https://vmqudc9i2l.execute-api.ap-south-1.amazonaws.com` |

Redeploy Pages (push to main or run workflow).

## 4. Optional: auto-check inbox

Lambda **rozka-gmail-drafts** (us-east-1 or ap-south-1) → Add trigger → EventBridge schedule:

- Expression: `rate(15 minutes)`
- Constant JSON: `{"action":"processAll"}`

## 5. User flow in app

Settings → **Connect my Gmail** → Google sign-in → drafts appear in Gmail when new human emails arrive.
