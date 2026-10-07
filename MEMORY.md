# Favmoney — Memory

> Persistent memory for the Favmoney project. Refer to this file every session.
> Last updated: 2026-10-07 (Day 1)

## 1. Project Overview
- **Name:** Favmoney (favemoney.site)
- **Idea:** Website where users complete tasks to earn money.
- **Timeline:** 7-day project. Day 1 = placeholder deploy only.
- **Stack decision (Day 1):** Static HTML/CSS/JS. No framework. Cloudflare Pages compatible.
- **Repo visibility:** Public.
- **Repo URL:** https://github.com/emma493/favemoney.site (created 2026-10-07, `main`, pushed, clean).

## 2. Domain & Deployment Status
- Domain bought: YES, not yet ready / not connected.
- Strategy: Deploy blank white page now to `*.pages.dev`, connect custom domain later with zero code change.
- Cloudflare Pages settings: Framework preset = None, Build command = (empty), Output directory = `/` (root).
- Current pages:
  - `index.html` — blank white, `noindex, nofollow` until launch.
  - `404.html` — blank white 404.
  - `robots.txt` — allow all (placeholder).

## 3. Day-1 Decisions Log
- 2026-10-07: Created blank white `index.html` for early GitHub + Pages setup.
- 2026-10-07: Chose root-level `MEMORY.md` + `USERCHATS.md` (simple, versioned).
- 2026-10-07: Added `README.md`, `.gitignore`, `404.html`, `robots.txt` as Day-1 infra best practice.
- 2026-10-07: Keep `main` always deployable. Future work in `/css /js /assets` (not yet created).

## 4. 7-Day Roadmap (draft)
- Day 1: Placeholder deploy + repo + Pages connection. DONE (code side).
- Day 2: Landing page design + copy (hero, how it works, FAQ).
- Day 3: Auth UI + task list UI (static mock).
- Day 4: Task detail / submit proof flow (frontend only).
- Day 5: Wallet / earnings dashboard UI.
- Day 6: Legal (Terms, Privacy), SEO, performance, mobile QA.
- Day 7: Launch prep + connect domain + remove `noindex`.

## 5. Open Questions / TODOs
- [x] GitHub repo created and pushed (https://github.com/emma493/favemoney.site) — 2026-10-07.
- [ ] User to connect repo to Cloudflare Pages.
- [ ] Confirm domain registrar + when DNS will be ready.
- [ ] Confirm task types, payout logic, anti-fraud needs (affects Day 3+ backend choice).
- [ ] Decide backend later (Cloudflare Workers / Supabase / Firebase?) — frontend-only for now.

## 6. Session Log
- 2026-10-07 Day 1: Initialized project, created placeholder files. Next: git push + Pages deploy.
- 2026-10-07 Day 1 (cont.): Created public repo `emma493/favemoney.site`, pushed `d21a070`, updated README. Next: Cloudflare Pages connect.
