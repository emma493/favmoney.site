# Favmoney — favemoney.site

Day-1 placeholder for the 7-day Favmoney project (task-to-earn site).

Right now this is just a blank white page so you can connect GitHub → Cloudflare Pages early, then connect your domain later with no code change.

## Structure

```
├── index.html    # blank white placeholder (deployed)
├── 404.html      # blank white 404
├── robots.txt
├── MEMORY.md     # AI + human memory — read every session
├── USERCHATS.md  # verbatim user chat log
├── README.md
└── .gitignore
```

Future (Day 2+): add `css/`, `js/`, `assets/` — keep `main` always deployable.

## Local preview

Just open `index.html` in a browser, or:

```powershell
npx serve .
```

## Push to GitHub (Day 1)

```powershell
cd D:\Favmoney\favemoney.site
git init -b main
git add .
git commit -m "chore: day-1 white placeholder + memory infra"
gh repo create favmoney-site --public --source=. --push
```

Or create the repo on github.com manually, then:

```powershell
git remote add origin https://github.com/<you>/favmoney-site.git
git push -u origin main
```

## Deploy to Cloudflare Pages

1. Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git
2. Select repo `favmoney-site`
3. Framework preset: `None`
4. Build command: (empty)
5. Output directory: `/` (root)
6. Deploy → you get `https://<project>.pages.dev` (white page = success)

## Connect domain later

Pages project → Custom domains → Add `favemoney.site` (+ `www` if wanted) → follow DNS prompts. No code change needed.

Before launch, remember to remove `<meta name="robots" content="noindex, nofollow">` from `index.html` / `404.html`.
