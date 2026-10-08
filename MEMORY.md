# Favmoney — Memory

> Persistent memory for the Favmoney project. Refer to this file every session.
> Last updated: 2026-10-08 (Real website day — blank page yesterday, full app today)

## 0. Permanent User Preferences (NEVER violate)
- **NO EMOJIS EVER.** User hates emojis. Use real icons, real SVG, real images only. No emoji in UI, code comments, or docs. This is permanent.
- **Storage:** Firebase is now LIVE (`js/firebase.js`, project `favmoney`, Auth + Firestore + Analytics-guarded). `js/store.js` (`FavStore`) remains as synchronous offline cache. Source of truth: Firestore collections `users/`, `wallets/`, `proofs/`, `cashouts/`, `waitlist/`. No `npm install` needed — CDN ES modules (`gstatic`, v12.4.0), Pages-safe, no bundler.
- **Stack:** Static HTML/CSS/JS, vanilla, Cloudflare Pages compatible. `main` always deployable.

## 1. Project Overview
- **Name:** Favmoney (favemoney.site)
- **Idea:** Website where users complete tasks to earn money.
- **Timeline:** 7-day project. Day 1 = placeholder deploy only.
- **Stack decision (Day 1):** Static HTML/CSS/JS. No framework. Cloudflare Pages compatible.
- **Repo visibility:** Public.
- **Repo URL:** https://github.com/emma493/favemoney.site (created 2026-10-07, `main`, pushed, clean).
- **Secrets rule (2026-10-08):** Repo is PUBLIC. All API keys / domains / IDs go in `VAULT.local.md` (gitignored, local-only, never commit). Before asking user for a value, Read `VAULT.local.md` first. Auto-save any vital value user drops in chat or assistant discovers, with date.

## 2. Domain & Deployment Status
- Domain bought: YES, not yet ready / not connected.
- Strategy: blank page shipped yesterday to `*.pages.dev`; real site ships today, custom domain later with zero code change.
- Cloudflare Pages settings: Framework preset = None, Build command = (empty), Output directory = `/` (root). Exclude from deploy/repo: `.agents/`, `.claude/`, `skills-lock.json`, `VAULT.local.md`, `node_modules/`.
- Current pages (all `noindex, nofollow` until Day-7 launch):
  - `index.html` — real landing (hero, how-it-works, earn, rewards, reviews, counter, FAQ, final CTA).
  - `tasks.html` + `task-detail.html?id=` — quest browse + milestones + proof submit.
  - `cashout.html` — 12 methods, $5 minimum, review queue.
  - `signin.html`, `signup.html` — Firebase email + Google.
  - `terms.html`, `privacy.html` — Day-3 preview stubs (full legal Day 6).
  - `404.html` — quest-aware 404.
  - Shared: `css/style.css`, `js/main.js`, `js/store.js` (offline cache), `js/firebase.js` (CDN v12.4.0), `firestore.rules`, `_headers`, `assets/favicon.svg`, `robots.txt`.

## 3. Day-1 Decisions Log
- 2026-10-07: Created blank white `index.html` for early GitHub + Pages setup.
- 2026-10-07: Chose root-level `MEMORY.md` + `USERCHATS.md` (simple, versioned).
- 2026-10-07: Added `README.md`, `.gitignore`, `404.html`, `robots.txt` as Day-1 infra best practice.
- 2026-10-07: Keep `main` always deployable. Future work in `/css /js /assets` (not yet created).

## 4. 7-Day Roadmap (live)
- Day 1 (yesterday): Placeholder deploy + repo + Pages connection. DONE.
- Day 2 (today): Real landing — DONE: Freecash-modeled hero/how/earn/rewards/reviews/counter/FAQ, no emojis, real SVG system.
- Day 3 (today): Earn + Cashout + Auth — DONE: quest list/detail/proof, 12-method cashout ($5 min), email+Google auth, offline `FavStore` cache.
- Firebase (today): Auth enabled by user; `js/firebase.js` live; `firestore.rules` ready to paste; collections `users/`, `wallets/`, `proofs/`, `cashouts/`, `waitlist/`.
- Day 4: Proof review states + wallet dashboard polish.
- Day 5: Earnings history + cashout statuses.
- Day 6: Full legal (Terms, Privacy), SEO, performance, mobile QA.
- Day 7: Launch prep + connect domain + remove `noindex`.

## 5. Open Questions / TODOs
- [x] GitHub repo created and pushed (https://github.com/emma493/favemoney.site) — 2026-10-07.
- [ ] User to connect repo to Cloudflare Pages (settings: None / empty / `/`).
- [ ] User to paste `firestore.rules` into Firebase Console (Auth already enabled).
- [ ] Firebase test matrix: sign-up → tasks synced → proof → cashout → sign-out/in.
- [ ] Confirm domain registrar + when DNS will be ready (connect Day 7).
- [ ] Confirm task types, payout logic, anti-fraud needs (affects Day 4+ review flow).

## 6. Session Log
- 2026-10-07 Day 1: Initialized project, created placeholder files. Next: git push + Pages deploy.
- 2026-10-07 Day 1 (cont.): Created public repo `emma493/favemoney.site`, pushed `d21a070`, updated README. Next: Cloudflare Pages connect.
- 2026-10-07 Day 1-3 build: No-emoji rule stored (permanent). Browser `localStorage` temporal via `js/store.js` (Firebase-ready). Rebuilt `index.html` with real SVG system (42 icons), Day3 pages `tasks.html`/`task-detail.html`/`cashout.html`/`signin.html`/`signup.html`, updated `404/terms/privacy/_headers`. Next: user connects Firebase, then Pages deploy.
- 2026-10-08 Firebase live: added `js/firebase.js` (CDN v12.4.0, Auth+Firestore+Analytics guarded), wired signup/signin (email+Google), tasks wallet sync, task-detail proofs, cashout requests, landing waitlist. Offline `FavStore` fallback kept. Next: enable Email/Password + Google in Firebase Console, set Firestore rules, test, deploy.
- 2026-10-08 Real website day: yesterday-blank vs today-full reconciled; `firestore.rules` added; hygiene decided (exclude `.agents/`, `.claude/`, `skills-lock.json`, `images/img.png` unused). Next: 3 clean commits + push + Pages preview.
