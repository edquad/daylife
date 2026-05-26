# DayLife

A **free, no-database** app for you and your partner to manage daily life — tasks, expenses, work notes, and home chores.

Everything saves in your **browser** (localStorage). No server, no Postgres, no monthly fees.

## Cost

| Option | Cost |
|--------|------|
| Run on your phone/computer | **$0** |
| Host static site (Netlify, Vercel, GitHub Pages) | **$0** |
| Custom domain (optional) | ~$1–2/month |

## Features

- **Dashboard** — today's tasks, spending, notes
- **Tasks** — Personal / Work / Home, assign to you or partner
- **Expenses** — daily spending by category
- **Work** — work tasks + daily journal
- **Home** — quick chores + household notes
- **Backup** — export/import JSON to move data between devices

## Quick start

```bash
cd daylife
pnpm install
pnpm dev
```

Open **http://localhost:5174**

1. Enter your name (and partner's name)
2. Tap your name to sign in
3. Start adding tasks & expenses

## Cloud save (automatic)

Your data **always syncs** to a private GitHub repo — no setup in the app.

| What | Where |
|------|--------|
| App | [edquad.github.io/daylife](https://edquad.github.io/daylife/) |
| Your data | [github.com/edquad/daylife-data](https://github.com/edquad/daylife-data) → `data/daylife.json` |

Open the app on phone or laptop — same data everywhere. Changes save automatically.

Local dev: add `daylife-ui/.env.local` with `VITE_GITHUB_SYNC_TOKEN=your_token` (optional).

## Deploy free on GitHub Pages

**Cost: $0** (public repo, GitHub hosts the static site)

1. Push this folder to GitHub (new repo, e.g. `daylife`)
2. On GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**
3. Push to `main` — the workflow in `.github/workflows/deploy-pages.yml` builds and deploys automatically

Your site will be at:

`https://YOUR_USERNAME.github.io/daylife/`

(replace `daylife` with your repo name if different)

Local build test for Pages:

```bash
cd daylife
$env:GITHUB_PAGES="true"; $env:REPO_NAME="daylife"; pnpm build   # PowerShell
pnpm preview --filter daylife-ui
```

Other free options: Netlify Drop, Vercel — upload `daylife-ui/dist` after `pnpm build`

## Sync between phones

There's no cloud sync (that would need a server/database). Instead:

1. **Settings → Export backup** on phone A
2. Send the JSON file to phone B (WhatsApp, email, etc.)
3. **Settings → Import backup** on phone B

Or use the same tablet/phone together and switch users on login.

## Project structure

```
daylife/
└── daylife-ui/    # React app — all data in localStorage
```

No API. No Docker. No database.
