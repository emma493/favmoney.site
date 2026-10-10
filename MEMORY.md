# Favmoney — Memory

> Persistent memory for the Favmoney project. Refer to this file every session.
> Last updated: 2026-10-09 (Earn cards: real photo thumbs, flat real-UI styling, compact rows)

## 0. Permanent User Preferences (NEVER violate)
- **NO EMOJIS EVER.** User hates emojis. Use real icons, real SVG, real images only. No emoji in UI, code comments, or docs. This is permanent.
- **Storage:** Firebase is now LIVE (`js/firebase.js`, project `favmoney`, Auth + Firestore + Analytics-guarded). `js/store.js` (`FavStore`) remains as synchronous offline cache. Source of truth: Firestore collections `users/`, `wallets/`, `proofs/`, `cashouts/`, `waitlist/`. No `npm install` needed — CDN ES modules (`gstatic`, v12.4.0), Pages-safe, no bundler.
- **Stack:** Static HTML/CSS/JS, vanilla, Cloudflare Pages compatible. `main` always deployable.

## 1. Project Overview
- **Name:** Favmoney (favmoney.site)
- **Idea:** Website where users complete tasks to earn money.
- **Timeline:** 7-day project. Day 1 = placeholder deploy only.
- **Stack decision (Day 1):** Static HTML/CSS/JS. No framework. Cloudflare Pages compatible.
- **Repo visibility:** Public.
- **Repo URL:** https://github.com/emma493/favmoney.site (created 2026-10-07, `main`, pushed, clean).
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
- [x] GitHub repo created and pushed (https://github.com/emma493/favmoney.site) — 2026-10-07.
- [ ] User to connect repo to Cloudflare Pages (settings: None / empty / `/`).
- [ ] User to paste `firestore.rules` into Firebase Console (Auth already enabled).
- [ ] Firebase test matrix: sign-up → tasks synced → proof → cashout → sign-out/in.
- [ ] Confirm domain registrar + when DNS will be ready (connect Day 7).
- [ ] Confirm task types, payout logic, anti-fraud needs (affects Day 4+ review flow).

## 6. Session Log
- 2026-10-07 Day 1: Initialized project, created placeholder files. Next: git push + Pages deploy.
- 2026-10-07 Day 1 (cont.): Created public repo `emma493/favmoney.site`, pushed `d21a070`, updated README. Next: Cloudflare Pages connect.
- 2026-10-07 Day 1-3 build: No-emoji rule stored (permanent). Browser `localStorage` temporal via `js/store.js` (Firebase-ready). Rebuilt `index.html` with real SVG system (42 icons), Day3 pages `tasks.html`/`task-detail.html`/`cashout.html`/`signin.html`/`signup.html`, updated `404/terms/privacy/_headers`. Next: user connects Firebase, then Pages deploy.
- 2026-10-08 Firebase live: added `js/firebase.js` (CDN v12.4.0, Auth+Firestore+Analytics guarded), wired signup/signin (email+Google), tasks wallet sync, task-detail proofs, cashout requests, landing waitlist. Offline `FavStore` fallback kept. Next: enable Email/Password + Google in Firebase Console, set Firestore rules, test, deploy.
- 2026-10-08 Real website day: yesterday-blank vs today-full reconciled; `firestore.rules` added; hygiene decided (exclude `.agents/`, `.claude/`, `skills-lock.json`, `images/img.png` unused). Next: 3 clean commits + push + Pages preview.
- 2026-10-08 Full-clone pass (no Academy, no policies): P1 landing parity (trust badge, app badges, full footer, prop floats, `assets/brands/`, `assets/props/`); P2 auth parity (Steam/FB/Apple styled buttons, `forgot.html`, abuse notice, dashboard redirects); P3 dashboard (`dashboard.html`, `history.html`, `referrals.html`, `settings.html`); P4 cashout 40+ methods, `js/stats.js` seeded randomizer, wording purge (zero demo wording), `sitemap.xml`. Next: push + Pages preview, then user customization.
- 2026-10-09 Auth simplification + landing strip-down: removed ALL Google sign-in/up (buttons, handlers, imports in `index/signup/signin/main.js`) — email-only auth; added 6-letter A-Z referral-code field on `signup.html` (live uppercase, `?ref=` prefill, stored as `refcode` in `FavStore`, frontend only, reward logic pending user); removed hero-visual, eyebrow badge, brand-mark SVGs + dead CSS, app-store badges + dead CSS, Earn/Cashout nav + mobile-nav links, hero CTAs, "See all cashout methods". Next: user supplies referral reward logic + earning-model picks.
- 2026-10-09 Web3/UI prep: installed 7 skills from skills.sh into `.agents/skills/` (lock in `skills-lock.json`) — UI: `frontend-design` (anthropics), `web-design-guidelines` (vercel-labs), `ui-ux-pro-max`; SVG: `svg-gen` (kaynetik, icons+logos+sprites, vanilla-SVG); web3 logic: `foundry-solidity` (tenequm), `agent-wallet` + `agent-solidity` (hec-ovi, EVM CLI + sandbox, copied solidity to top level), `software-crypto-web3` (vasilyu1983, security-first). Skipped: `eddiebe147 Icon Designer` + `404kidwiz blockchain-developer` (repos private/dead), `gsp-icons` (interactive-only). Direction set: web3 Favmoney earning platform; SVG-first asset design (badges, marks) per svg-gen rules.
- 2026-10-09 Earn rebuild: 8 method cards on `earn.html` (user order, approved renames: Offers & Apps, Paid Surveys, Watch Ads, Quiz & Earn, Free Faucet, Spin the Wheel, Flip to Win, Dice Roll) with inline SVG sprite (6 new `earn-*` symbols per svg-gen + reused dice/cards shapes), whole-card links to 8 new blank placeholder pages (bg `#1D1E30` only). Back-arrow + chip-everywhere + real sub-pages pending.

## 7. Earning-Sites Research (2026-10-09, study only — NOT implemented)

> Source: live-site fetches + review blogs. Figures are as-reported; treat review-blog numbers (esp. referral %) as unverified where noted.

### 7.1 viefaucet.com (Vie Faucet)
- **Unit:** internal free-floating **tokens**, withdrawn as crypto of choice (BTC, LTC, DOGE, TRX, USDT, SOL, PEPE, SHIB, FLOKI...). Homepage estimator: faucet 2,925 + PTC 13,500 + shortlinks 3,000 + surveys/offers 150,000 = ~169,425 tokens/day ≈ **$1.69**. Surveys/offers = ~88% of daily potential.
- **Methods:** (1) Faucet claim — 2 captchas/puzzles, ~50-65 tokens, ~4-min timer. (2) PTC ads — view 10-60s + captcha, pays above faucet, AdBlock must be off. (3) Shortlinks — click-through + captchas, fast but spammy (malware/scam risk noted by reviewers). (4) Surveys/Offers/Offerwalls — highest pay, third-party. (5) Daily bonus/streak — login daily + watch >=2 PTC ads to level up: flat tokens **plus a % claim bonus on all future claims**. (6) Challenges/milestones — e.g. 20 claims -> 100 tokens, 50 claims -> 150 tokens; daily/weekly goals. (7) Level system — level = f(total claims), higher level = higher rewards. (8) Leaderboards/weekly contests (referral + offerwall). (9) Referrals — official FAQ: **up to 10% of friend earnings**, link on Referral page. (10) Vouchers — advertiser-side PTC discounts (demand side, not user earning).
- **Cashout:** ~500 tokens min to FaucetPay or direct wallet, near-instant (seconds); low-fee coin (LTC) recommended.
- **Anti-fraud:** mandatory email verification; no multi-accounts/same network; no bots/VPN/proxy (ban); per-claim captchas.
- **Money logic (key):** **arbitrage** — advertisers pay for PTC/shortlink traffic, offerwall networks pay affiliate commissions; platform keeps margin, redistributes rest as tokens. Faucet is a loss-leader/retention loop funded by high-margin surveys. Streaks/levels/challenges/contests exist to raise DAU, which raises ad-inventory value.
- **Caution:** viefaucet.com (tokens) vs viefaucet.in (satoshi-based, different thresholds/referrals) are different sites. Default assumption for "like Vie" = .com model.

### 7.2 earnbitmoon.club (EarnBitMoon)
- **Unit:** internal **Coins pegged to USD: 10,000 Coins = $1**. Withdraw as crypto (BTC, DOGE, LTC, TRX, ETH, USDT, SOL, SHIB, BNB, DASH+) via FaucetPay/Cwallet/Payeer/direct. Min ~2,000 Coins (~$0.20) on FaucetPay, higher direct. Instant. Advertised: ~1.35M members, ~$828k paid. Launched 2021.
- **Methods:** (1) Faucet **lottery roll** every 5 min — captcha, roll 1-99,999; usually 5-8 Coins, 99,999 = **20,000-Coin jackpot**. Tiny EV + jackpot dream. (2) PTC — 2-40s views + captcha, 2-7 Coins; most reliable, no disqualification. (3) Shortlinks — 8-30 Coins each, daily per-link caps. (4) Offerwalls/surveys (16+ partners: CPX, BitLabs, Lootably, Monlix, TimeWall, AdGem...) — one 15-min survey $0.50-1.50; app/game milestones pay large lumps. Reviewer $1/day blueprint: daily bonus -> clear PTC -> pin faucet tab -> 1-2 surveys. (5) Daily bonus streak — grows per consecutive day, **miss a day = reset to zero** (harsh retention lever). (6) Achievements — e.g. 20 claims / 10 PTC views -> bonus Coins. (7) **Levels: 38 tiers** by EXP (faucet/shortlinks/offerwalls); each raises a **faucet multiplier** (L2 ≈ x1.20); final tier needs ~200k claims (unreachable by design = endless ladder). (8) **Memberships (paid tier)** — faucet boost + lower min withdrawal. (9) Daily/weekly contests (cash). (10) Referrals — homepage headline **40% lifetime**; detailed sources: **10% on faucet + 5% on offers/PTC/shortlinks**, unlimited, no bought/spam referrals, upline never changes, dead referrals pay nothing. Treat split rate as verified structure, 40% as marketing. (11) Browser mining — 1 Coin per 120k hashes (negligible, zero-effort engagement). (12) Provably-fair investment game (gambling extra, not earning logic).
- **Anti-fraud (strictest seen):** Gmail emphasis (hotmail/outlook block crypto mail); no VPN/proxy/**virtual cards** on offers; no repeating same offer across partners; partner tracking final (blocked cookies = no credit); **high-risk offer earnings held up to 45 days**; 2FA available; gender+country at signup.
- **Vs Vie:** same skeleton, different tuning — USD-pegged coins (clean accounting) vs floating tokens; lottery faucet vs flat faucet; harsh streak reset vs PTC-gated streak + % bonus; 38 explicit multiplier tiers vs vague claim-count levels; split referral vs flat 10%; plus memberships/mining/game/holds that Vie lacks.

### 7.3 Spin-the-wheel (cross-site pattern)
- **What:** visual prize wheel; Spin -> animation -> segment -> instant credit. **Variable-reward lottery layer** atop base economy. Tuning differs, structure identical.
- **Spin supply:** free periodic (daily / weekly / hourly-as-faucet); **earned** via tasks (faucet claims, PTC, shortlinks, offerwalls, referrals, level-ups, achievements); paid (balance or token-holding tiers, e.g. FreeBitco.in Premium up to 16/day); promo (email-coupon spins expiring 48h, push-subscription spins — doubles as re-engagement/list-growth).
- **Prize design (weighted, never equal):** e.g. 100 Pts @10%, 500 Pts @8%, 5,000 XP @5%, +5% Boost @3%, +1 Hash/s @1%. Universal: small = very high prob, jackpot = very rare (RNG; legit sites provably fair via HMAC-SHA256). Prize types: coins/tokens, XP, multipliers, % boosts, hashrate, free claims, lottery tickets, points, cashback, headline physical prizes (Rolex/iPhone — near-zero odds bait). Trust variants: **every spin wins** (e.g. min 50-max 1,000 Coins, no blanks) vs **can land on nothing** (cheaper, more frustrating).
- **Abuse controls:** cooldowns + account binding (spin ID claimable exactly once); first spin -> main balance, repeats -> **bonus balance with playthrough requirement**; captcha pre-spin; promo expiry; email-verified claim (Lightning Faucet creates the account AT claim from just an email — acquisition funnel).
- **Why operators love it:** (1) retention loop independent of task inventory; (2) engagement amplifier — spins earned BY tasks make base pay feel bigger; (3) jackpot marketing at ~0 cost; (4) email/push capture; (5) **boost prizes cost future margin, not cash today**.
- **Favmoney fit (not built):** dashboard "Daily streak + Claim today" card could become 1 free spin/day (prizes = pending cents, streak multiplier); flows through existing `proofs` queue (`status:pending` + `label`); referral field could grant bonus spins later.

### 7.4 Flip-to-win / memory match (cross-site pattern)
- **Loop:** face-down grid -> flip two -> match stays + pays, mismatch flips back -> clear board. Skill = memory + speed. Scoring universally: **per-match pay + time bonus + move-efficiency bonus + consecutive-match streak bonus** — the combo is the anti-farm device (random clicking earns a fraction of skilled play).
- **Earning models:** (1) **RollerCoin (best fit):** Coin-Flip/Coin Match pay **temporary mining power (24h)** = share of reward pool, not cash; monetization via purchased permanent-power miners. *Skill games = engagement engine; power/multiplier = currency.* (2) **Steem Memory Game:** Free Mode (practice, $0) vs Paid Mode (1 STEEM entry -> pool; winner gets entry back + 70% of others' = 30% house rake); daily challenges + per-mode leaderboards. *Entry fees fund pool; free tier = onboarding funnel.* (3) **PvP staking:** fixed $1 stake, 45s duel, winner 2x (rake-funded, operator risk-free). (4) **Pay-per-play + penalty helpers:** entry in cents; helpers (reveal-all, auto-match) cost **+5s score penalty** — monetizes impatience without wallet charges. (5) **Match-to-mint NFT:** each pair mints an NFT to wallet (gameplay as minting ceremony; overkill for Favmoney, noted). (6) **Points-to-cash (BitMaker pattern):** points -> BTC at high thresholds, fractions of a cent — feels scammy per reviews; avoid.
- **Edges:** difficulty tiers (6-72 cards), themes, global leaderboards (points/time/country), seasons, on-chain score audit, skill matchmaking in PvP.
- **Anti-abuse:** skill-gating (bots uneconomical), timer + move-count scoring, leaderboards; near-zero operator cost per play (no ad inventory consumed).
- **Favmoney fit (not built):** fits as a **quest type** ("clear 8-pair board in <=24 moves -> $X pending") reusing the existing proof flow (`task-detail.html` -> `proofs` collection). RollerCoin variant (win = streak multiplier/bonus, not base cash) stacks on `pending`/`lifetime` without repricing quests. Steem variant (entry-fee pools) does NOT fit — no deposit system, do not build one.

### 7.5 Cross-model comparison (for future design picks)
- **Faucet style:** Vie flat ~50-65/timer vs EBM lottery roll + jackpot. Pick one.
- **Currency:** EBM USD-pegged points (clean accounting) vs Vie floating tokens. Favmoney currently direct-USD (`pending`/`lifetime`) — open question whether to add a points layer.
- **Streak:** EBM harsh reset-to-zero vs Vie PTC-gated + % claim bonus.
- **Levels:** EBM 38 explicit multiplier tiers vs Vie vague claim-count levels.
- **Referral:** EBM 40% headline / 10%+5% split vs Vie 10% flat. User to supply Favmoney referral reward logic (pending — `refcode` field already on signup, frontend only).
- **Retention layers:** wheel = variable-reward loop; flip = skill-gated loop. Both gate supply via cooldowns/earned tickets and pay partly in boosts, not cash.
- **Revenue engine (all sites):** advertiser spend (PTC/shortlink/banners) + offerwall affiliate cuts fund user payouts; faucet/wheel/flip are retention loss-leaders; anti-fraud strictness scales with payout generosity.

## 8. Thirty-Site Faucet/GPT Survey (2026-10-09, study only — NOT implemented)

> Method: homepage fetches (Cointiply, Fire Faucet, AdBTC, Idle-Empire, FaucetPay, EarnCrypto) + review-blog deep dives + grouped searches. Depth varies: Tier A (fetched + multi-review), Tier B (review-covered), Tier C (brief/aggregator-covered). Figures are as-reported, treat as approximate. Two list entries are dead (Coinpot family shut Feb 2021; DogeMate offline without notice) — kept for the lessons.

### 8.1 Tier A — deep studied

- **Freecash** — already the Favmoney reference model (hero/how/earn/rewards/reviews/counter/FAQ cloned Day 2-3). Survey/offerwall-first GPT, BTC/LTC/ETH + gift cards. Lesson: offerwalls pay ~88% of real earnings; landing sells trust (stars, counters, reviews) not mechanics.
- **Cointiply (2018, US, 4.3M users)** — Coins at 10,000 = $1; BTC/DOGE/DASH/LTC out, $3 min, no fees, pays chain costs. Hourly faucet roll (10 Coins base, 100,000 jackpot) + **loyalty +1%/day to 100%** (miss = reset to 0) + **Cointiplier 1.5x-2x by activity** (stacks to 4x+). Offerwalls/surveys = real money ($1-3/day). **5% APR interest** on 35k+ balances, weekly Sunday payout, 1 action/week required (passive layer for holders). PTC, videos, chat **rains**, mystery boxes, daily wheel/streak, 61x multiplier dice (gambling), mobile app. Referrals: **25% faucet + 10% offers, lifetime**, no same-household. No VPN. Lesson: loyalty + interest + multiplier triple-stack makes holding rational; chat rains = free community retention.
- **Fire Faucet (2018, 1.6M users, 941M tasks)** — richest design seen. **Three currencies: ACP (spendable) + Activity Points (levels) + Fuel (automation energy).** Earn ACP via surveys/apps/offers (CPX, BitLabs, PureSpectrum, TheoremReach, Adscend) then **Auto Faucet converts ACP to crypto on their servers — even with the tab closed** (no mining, no open tab; instant-convert option too). 13 cryptos + local gift cards (geo-targeted, e.g. Ghana list). Levels raise ACP value, fuel capacity/recharge, payout boosts, multi-currency slots. Power Streak (daily offer goal + **Streak Savers**), daily leaderboard top-100, daily tasks, Happy Hour (50% auto-faucet weekends), 30-min faucet, community chat. **ChargeSafe**: absorbs advertiser reversals (weeks later) so balance never drops — logged transparently. Fees covered, no KYC, email only, VPN blocked. Lesson: background automation + reversal insurance are the two most differentiated retention mechanics in the whole survey.
- **FaucetCrypto (2017, RPG-themed)** — Coins at 25,000 = $1, direct-to-wallet (no FaucetPay), ~1,000-Coin min. PTC/surveys/offerwalls/shortlinks/challenges/contests. **EXP only on tasks >= 5 Coins; every level = permanent +0.1% bonus; L15 unlocks Offerwalls; 500+ Coin rewards release instantly only at L10+** (else 24-48h hold — anti-fraud via progression). **Items** (Potions, Bracelets, Rings, Gems): random task drops affecting bonuses/referrals/EXP/drop-chance, tradable on internal **Item Market** (buy/ask orders). Recurring faucet removed May 2026 — now pure task + progression. Custom anti-bot (no Google captcha), left-nav dashboard, offerwall Trust Score. Referral 25%. Lesson: progression-gated unlocks + holds + player market = RPG retention without raising base pay.
- **Final Autoclaim / DutchyCorp (2019, 70+ coins)** — **DUTCHY** (USD-fixed internal token; BTC-pegged rate refreshes 30 min) fuels everything. Dual 30-min rolls (DUTCHY roll + voted coin-of-month roll) with **Boosted Roll: +50% for watching 14s of banners**. **Autofaucet**: spend DUTCHY to auto-claim chosen coins on timers (1-10 min), multipliers 1x-7x (6x+ needs L300/Platinum), REFRESH vs IN-PAGE modes. **Expert Mode**: assign 100% pool weight across coins via presets (memecoins, Top-100, gainers...). **DUTCHY Mode**: burn 100 -> 105 every 5 min (5% cycle profit, needs L50/membership). SPACE token (stake, bonuses, BSC/Polygon/Fantom/Avax), CPU/GUI mining, gift cards/codes, RainBot, weekend power bonus, micro-tasks with proof review (auto-approve 72h), advertiser side. Referrals: 20% faucet/shortlinks, 10% offerwalls/games. Level bonus +0.1%/level. FaucetPay out. Lesson: one fuel token powering manual + auto + staking + ads = deepest internal economy; complexity is the cost.
- **EarnBitMoon / Vie Faucet** — see Section 7 (already documented). EBM = USD-pegged Coins, lottery faucet, 38 multiplier tiers, harsh streak, 40%-headline referrals. Vie = floating tokens, flat faucet, PTC-gated streak + claim-% bonus, 10% referrals.

### 8.2 Tier B — review-covered

- **FreeBitco.in (2013, 39M+ users)** — oldest. Hourly roll to $200 BTC + 2 lottery tickets + 2 reward points per roll; weekly $7,500 lottery; **Wheel of Fortune** (Rolex/$15k/iPhone/gift cards, spins via promo-email coupons expiring 48h, provably fair); FUN-token Premium (up to 16 spins/day, interest boost, 1% cashback); Multiply dice to 4,750x; rewards catalog (gadgets, wallets, gift cards). Points from rolls (1 pt/roll), referrals (1 pt/referral roll), wagering. Lesson: email-coupon spins = list-growth machine; every action drips points toward a catalog.
- **Coinpayu (now rebranded RewardJoy)** — clean PTC-first network: surf ads, faucet, multi-coin, staking tokens. Forces AdBlock off. Lesson: PTC-pure positioning + clean UX is itself a differentiator (reviewers repeatedly praise uncluttered PTC).
- **AdBTC (RU/EN/ES)** — surf + active-window ads, live counters (users online, impressions today), CPC from 1 sat for advertisers, 500-sat min withdrawal, affiliates **10% of referral surfing + 5% of referral ad spend** (two-sided: earn from their work AND their spend). Lesson: affiliate cut on advertiser spend recruits promoters, not just earners.
- **Idle-Empire (2015)** — **Steam-login** (plus Google/FB/X/Discord), earns skins/games/gift cards/crypto. Points from tasks/offers/videos/mobile games/software tests/referrals; withdraw CS:GO/TF2 skins via markets. Leaderboard, community, blog. No faucet, higher survey rates. Lesson: identity via existing gamer accounts (Steam) kills signup friction for a gamer audience; skins are a withdrawal rail reviewers love.
- **FaucetPay (infrastructure)** — 600+ verified faucet aggregator + micro-wallet + PTC/offerwall + swap + staking of **FEY** token (yield auto-compounds daily, fee rebates, claim multipliers) + provably-fair originals (Dice/Crash/Plinko/Limbo/Roulette) + **faucet-owner REST API** (scoped keys, idempotency, daily caps, MCP server). 300M+ rewards paid, instant P2P no-fee, 2FA default. Lesson: whoever owns the wallet + API owns the ecosystem; aggregator + staking + owner-tooling = moat.
- **Brave Rewards** — browser-native: opt-in privacy ads (device-side matching, no profiling), **70% of ad revenue to users in BAT** (publisher-integrated split 70/15/15), monthly payouts via custodians (Uphold/Gemini/bitFlyer) or self-custody, auto-contribute + tips to verified creators (blue checkmark). vBAT sunset forced custodial. Lesson: revenue-share % published openly (70%) = trust; attention itself is the task — zero extra effort.
- **EarnCrypto (legacy GPT)** — offer walls + surveys + videos + data entry (Type-Is-Money PP) + custom user-posted jobs + browser miner; 68-coin choice; 10% referrals; high $18 BTC min + $1.82 fee + 7-day processing (reviewers' top complaint). New earncrypto.com pivoted to Learn-and-Earn (daily quiz lessons). Lesson: high thresholds + slow payouts kill goodwill faster than low rates; education-as-task is a fresh variant.
- **GraBTC (2020, Brazil)** — BTC-only (Bits = satoshis), hourly roll to 99,999, ~50 shortlinks/day, PTC (focus-tab enforced), **one-time promo jobs** (videos/posts with proof screenshots — users market the site), payment-proof-forum bonuses, CPU miner (1 bit/40k hashes), **BTC price Call/Put 5-min game at 1.3x**, monthly lottery, achievements (50 faucet claims = 48 bits), monthly contests ($1,000+ pools), memberships, **offerwall-completion bonus (+2.5 bits/roll for 24h)**. Referrals: 12% faucet + 3% offerwall + 1% shortlinks. 5,000-sat FaucetPay / 20,000 direct min, 20-claim minimum before first withdrawal. Lesson: promo jobs + payment-proof bounties turn users into marketers; offerwall bonus that boosts the faucet cross-links methods.
- **BetFury Boxes** — casino faucet as **boxes**: FUNFURY box (Rank 1, hourly, 7,200/day max) + BTC box (Rank 2+, ~0.00001012/day) + Boost Box (deposit interest) + NFT lootboxes. 24 hourly refills, no missed-claim penalty (but no backlog), captcha-gated, team-funded separate from staking pool, 20% referral on box withdrawals. Lesson: "open a box" framing beats "claim faucet" psychologically; rank-gating the BTC box drives the first deposit-equivalent milestone.
- **BC.Game faucet** — BCD (native, non-withdrawable) multi-claim faucet + **chat rain** (fractional tokens dispersed in chat). **Play-to-withdraw**: 1x-5x wagering through Dice/Crash/Mines converts BCD to BTC/USDT. Lesson: rain = community-presence reward; wagering requirements make faucet funds engagement-locked.
- **Bitsler (2015, casino)** — faucet exists as **Nitro**: daily claim sized by yesterday's activity (play/results/XP), Platinum+ only, 14-42 day windows; plus rain, tournaments, sportsbook. Lesson: activity-based faucet (pay yesterday's actives) targets retention spend precisely.
- **Fautsy + sisters (starbits/claimbits/gobits/i-bits, since 2015)** — 5-6 min BTC faucet (10-30 sats), **CLAIM EXTRA +5 shortlink bonus** stacked onto next claim, switchable captchas (SolveMedia/reCAPTCHA), FaucetPay-only, 20% referrals. Mixed-to-scam Trustpilot history (threshold bans, balance cuts, v2 rollback). Lesson: keep a cautionary entry — threshold manipulation + login locks are the classic faucet exit pattern.
- **CryptoWin (2020, same group as above)** — 15-min faucet + lottery tickets per claim, PTC vs Surf Ads (framed-focus vs new-tab), advertiser CPC menu by duration (10s=3 sats ... 60s=10), banner-removal + geo-filter upsells, **share lock 1,000 sats/180 days** (investment), weekly Friday lottery, deposits allowed. Referrals: 50% faucet / 10% PTC+offerwalls / 2% share. Flagged SCAM 2023. Lesson: deposits + locked shares = the line between faucet and Ponzi-adjacent; do not cross.
- **Allcoins (2018, 29+ coins)** — Classic faucet (6 min, wager/donate/balance/**Motivation-for-Harvest** options) + Autofaucet/floodgate (2 free claims/day, shortlinks top up) + CPU + command-line GPU miner + internal exchange + converter + dice/lottery/Harvest game (300-sat worker, unexplained) + **chat quiz bot** (1 sat per correct answer). 25% referrals. Direct-withdraw fees absurd (3,500-sat fee on 5,000 BTC) vs cheap native-token rail. Lesson: feature sprawl without finishing (unexplained games, chunky UI) reads as abandonment; fee design steers rails.
- **AltHub (2018)** — altcoin faucet (3-min, 30 claims/day/coin) + PTC + shortlinks + offerwalls (L10) + mining sim + **ALTH internal coin** (earn, sell for crypto) + Power Claim/loyalty bonus + lottery + levels + achievements. 20% referrals (10% offerwalls / 25% shortlinks+PTC split), 500-Coin signup bonus, 100,000 Coins = $1. Lesson: internal coin WITH its own earn/burn loop (not just accounting) adds a game layer cheaply.
- **DogeMate (2019, Bangladesh) — OFFLINE without notice** — was: hourly roll (20-5,000 coins), PTC/shortlinks/offerwalls (L10)/videos/mining, dual bonus (level-random + roll-loyalty), rain-captcha daily faucet, achievements (4 tracks, daily/weekly/one-time), promo tasks (promote on Twitter/Telegram/blogs/YouTube), 4-rail withdrawal. Referrals 10% offerwalls / 25% rest. Lesson: sudden offline death with balances inside — keep custodial balances tiny and withdrawals instant.
- **ClaimBits** — 5-min BTC loops, surveys/tasks/PTC, CPU-mining sim, FaucetPay 1,000-sat min. Trustpilot split: real fast payouts vs rate-change complaint (1 coin = 1 sat -> 10,000 coins = $1 overnight shrank balances 85%). Lesson: **never re-denominate the internal currency against holders** — the fastest way to burn trust.
- **Coinpot family (2014-2021) — DEAD, kept for lessons** — Moon BTC/DOGE/LTC/DASH/Cash + BitFun + BonusBitcoin feeding one wallet; games/multiplier/challenges/VIP/mining. Closed Jan-Feb 2021: hobby-run, ad margins thin, **fraud-fighting became the biggest time cost** ("small profit margins wiped out overnight"). Fraud engine lived on as their next project. Some users reported balance wipes on exit. Lesson: (1) budget anti-fraud as a first-class cost from day 1; (2) graceful sunset tooling (conversion + withdrawal windows) matters; (3) hobby economics cap scale.

### 8.3 Tier C — brief entries (aggregator/review-covered, thin sources)
- **SwissAdSatoshi** — premium fixed-hourly BTC faucet + PTC wall; mixed BitTrust history (slow/denied withdrawals) — thin/aging signals, treat as high-risk reference only.
- **BetFury** — see Tier B boxes (same operator). Native BFG, staking parallel to boxes.
- **Satoshilabs** — lab-themed mining-sim faucet: passive token generation + timed crypto claims; same sim-game family as AltHub/RollerCoin. Thin sources.
- **Protyon** — single-click claims, instant low-gas micro-wallet payouts. The minimalist endpoint of faucet design (one click, no game). Thin sources.
- **A-Ads Faucet (faucet.a-ads.com)** — ad network's own faucet: random daily satoshi drops to native BTC addresses. noteworthy as **demand-side-owned supply** (the advertiser buys the audience, then pays it directly). Thin sources.
- **Cryptoly** — captcha faucet + referral matching engine + minimal micro-withdrawals. Thin sources.
- **EarnCrypto legacy** — see Tier B (GPT review) — note new earncrypto.com is Learn-and-Earn, different product.
- **Idle-Empire** — see Tier B. (Listed once; no duplicate.)
- **Coinpot.in (list URL)** — resolves to the dead Coinpot family above; do not treat as live.
- **FreeBitco.in** — see Tier B. (Listed once; no duplicate.)

### 8.4 What users DO to earn (universal action catalog)
1. Timed claims (faucet rolls, boxes, check-ins) — captcha-gated, 1 min to 24 h timers.
2. View ads (PTC surf/active-window/video, focus-tab or background).
3. Click through shortlinks (pages + captchas + timers, daily caps).
4. Complete surveys/offers/app-installs/game milestones (offerwalls — the real money).
5. Post jobs/proof bounties, promo tasks (market the site itself).
6. Mine in background (CPU/GPU/browser, real or simulated).
7. Play skill/chance games (memory, dice, multiplier, lottery, wheel, flip).
8. Keep streaks, climb levels, clear achievements/challenges/contests.
9. Refer others (link + cut of their earnings and/or their ad spend).
10. Hold balances/tokens (interest, staking, premium tiers).
11. Chat/rain participation (presence rewards).
12. Learn (quizzes/lessons), contribute (tips to creators).

### 8.5 The logic behind it (money engine, all 30 sites)
1. **Arbitrage core:** advertiser spend (PTC/shortlink/banner/CPC) + offerwall affiliate commissions + survey-research budgets come in; a cut goes out as user rewards. Faucets are loss-leader retention loops funded by high-margin methods (surveys/offers first, PTC second).
2. **Internal currency:** every site abstracts payouts into points/coins/tokens (usually USD-pegged: 10k or 25k = $1; rarely floating). Purposes: hide per-action micro-values, enable cross-coin cashout, allow bonuses/multipliers, permit re-denomination risk (see ClaimBits warning).
3. **Progression economics:** levels/loyalty/multipliers/interest raise *future* payout rates instead of current cash — liability stays small while perceived value compounds.
4. **Boost-not-cash prizes:** wheels/challenges pay boosts, spins, claims, hashrate — future margin, not today's cash.
5. **Two-sided referrals:** cut of referral *earnings* (standard) and/or referral *ad spend* (AdBTC 5%) — the latter recruits promoters.
6. **Automation premium:** autofaucets (Fire, Dutchy, Allcoins) convert active earnings into passive drips, gated by fuel/tokens/levels — sells the dream of "earn while away."
7. **Insurance & holds:** ChargeSafe-style absorption vs level-based release delays vs 45-day high-risk holds — three ways to handle advertiser reversals.
8. **Fraud budget:** Coinpot's epitaph — fighting bots/cheaters becomes the dominant cost; captchas, focus-tabs, device/household bans, VPN blocks, tracking-finality, email/gender/country KYC-lite are the standard stack.
9. **Death patterns:** threshold hikes + withdrawal stalls (Fautsy), deposit/lock products before collapse (CryptoWin), silent offline (DogeMate), re-denomination (ClaimBits), hobby burnout (Coinpot). Design irreproachably in the opposite direction: low min, instant, no deposits, no re-denomination.

### 8.6 UI/UX patterns observed (for future Favmoney design)
- **Left-nav member dashboard** (FaucetCrypto, CryptoWin): Earn section grouped by method with live counts (e.g. shortlink badge number); balance + level bar pinned top.
- **Live counters as trust:** members online, impressions today, paid-out totals, payout history feed (EarnCrypto live feed, AdBTC counters, Fire preview widget).
- **Estimator sliders** (Vie homepage): adjust activity sliders -> daily earnings preview. Converts vague promises into concrete numbers.
- **Framed PTC viewer:** ad in bottom frame + timer/progress top frame + CONTINUE button; surf-ads variant opens new tab (no focus needed) — pick per attention price.
- **Roll tables:** lucky-number ranges mapped to payouts shown beside the button; jackpot row highlighted. Transparency of odds = trust.
- **Streak/loyalty visualization:** % bonus bar climbing to 100%, savers shown as shields, reset warnings explicit.
- **Quest-board offerwalls:** provider cards (CPX, BitLabs...) with per-task coin values, geo badges, milestone/deadline fine print, Trust Score.
- **Chat + rain:** persistent community panel doubles as support deflection + presence rewards.
- **Onboarding in 3 steps** (EarnBitMoon: account -> tasks -> withdraw) + Steam/social login (Idle-Empire) + email-only claim-to-account (Lightning Faucet pattern from wheel study).
- **Ad-density discipline:** reviewers consistently praise low-ad sites (GraBTC, FaucetCrypto) and punish pop-up mazes (Dogemate) — UX restraint is a competitive feature.
- **Anti-patterns to avoid:** missing balance display ("don't make me solve a captcha for 0"), silent re-denominations, login loops, support black holes, withdrawal minimums that move.

### 8.7 Takeaways shortlist for Favmoney (design picks, NOT approved/built)
1. Keep direct-USD wallet (no points layer) unless accounting needs it — open question from 7.5 stands.
2. Best-in-class retention combo to consider: daily streak with visible % + streak savers (Fire/Cointiply) + earned wheel spins (8.3 pattern) + skill-gated flip quest (7.4) + achievements with instant micro-bonuses (GraBTC).
3. Reversal handling: pick one — ChargeSafe-style absorption, level-gated instant release (FaucetCrypto L10), or 45-day holds (EBM) — before real money flows.
4. Referral: user to supply amounts; menu is 10% flat (Vie), 25/10 split (Cointiply), 10/25 split (DogeMate/AltHub), 40%-headline (EBM), 10%+5%-spend two-sided (AdBTC).
5. Trust kit: live counters, estimator, published odds tables, low $5 min (already have), instant local credit with Firebase-synced review queue (already have).
6. Never: deposits, lock-ups, re-denominations, moving minimums, silent shutdowns.

## 9. Grow Engine (2026-10-09, BUILT — needs firestore.rules paste + live test)
- **Rates (user-locked):** 3000% base APR always on; ad view lights +1500% (4500% total) for exactly 1h; refill tops to 60:00, no stacking/banking; expiry falls back to 3000%. Calibrated 5→3500% ladder in chat; tiered/promo framing recommended if rates ever change.
- **Seed:** every account gets $1.00 invested (invest-only: principal never moves to available, yield claimable). New signups via `ensureUserDoc`; legacy via `ensureSeed` on Grow visit.
- **Scope:** only task earnings stakeable (max $100 user principal, min $0.10). Referral $1/$0.50 + commissions excluded from staking AND from commission-on-commission (`recordCommission` + `creditReward` skip `referral-*`/`invest-*`/`ad-*` labels).
- **Activity gate:** yield accrues only on UTC days with a rewarded action (`users.activeDays`, max 90, stamped by `creditReward`, pruned in `ensureSeed`).
- **Seed ignition (fixes frozen-ticker first impression):** the $1 seed accrues base rate for 72h post-signup (`INVEST_SEED_GRACE_MS`, seed-only, boost still applies) even with zero activity; afterwards the gate applies. Bounded ≈$0.25/bot. Ticker shows live countdown of ignition time.
- **Settlement:** pure timestamp math (`computeYield`: per-day segments × active gate × base/boost split by `boostUntil`), 90-day window cap; settle-then-act ordering on stake/unstake/boost so no double-pay; ticker interpolates locally via rAF (5s fallback for reduced-motion).
- **Ad viewer:** house promos, 20 visible-seconds (hidden-tab pauses), CONTINUE → `activateBoost`; `ad-view` proof rows; third-party rewarded ads plug into the same callback later.
- **Pipes fixed en route:** `creditReward` was silently NOT filing commissions (edit had landed in `migrateLocal` loop, which also broke on undefined vars) — both repaired and verified.
- **Files:** `firestore.rules` (wallets `invested/investedAt/boostUntil`, users `taskEarned/investedUser/activeDays`, proofs `invest-*/ad-view` done-labels), `js/firebase.js` (invest engine + seed + hooks), `grow.html` (ticker, fuel gauge, invest/claim/unstake, history, FAQ, viewer).
- **Still required:** paste `firestore.rules` to Console; live test (signup seeds $1 → earn task → stake → ticker climbs → ad boosts slope → close 90min → reopen settles 60 boosted + 30 base min → claim/unstake correct, seed stays).

## 10. Diamonds (2026-10-10, BUILT — needs firestore.rules paste + live test)
- **Model (user-locked):** play-only chips, never withdrawable/convertible. Floating chest bottom-right on earn/spin/flip/dice/profile/grow: tap → 20s visible ad → 2–10 diamonds (weighted 2@30%/3-5@50%/6-10@20%), 1h cooldown; passive 2 diamonds per 3h, claimable on tap (glows, no stacking).
- **Games:** 1 free play/day each (to build); extra plays cost diamonds — Spin 10 / Flip 15 / Dice 5 are placeholder constants (`DIAMOND_GAME_COSTS`, USER TO CONFIRM when each game is built). Wins: mostly diamonds via `creditDiamonds()`, rare USD cents via existing `creditReward()`.
- **Files:** `js/firebase.js` (constants, `rollDiamondReward`, `getChestState`, `claimDiamondAd/Passive`, `spendDiamonds`, `creditDiamonds`; wallet heals old docs; commissions + Grow gate exclude `diamond-`), `js/diamonds.js` (shared chest + `paintDualChip`), `css/style.css` (chest + `.dia` chip styles), `firestore.rules` (wallet `diamonds/lastDiamondAdAt/lastDiamondPassiveAt`, proofs `diamond-*` amount-0 rows), wired into earn/spin/flip/dice/profile/grow headers; profile shows Diamonds stat + DIA history rows; `diamond-play:*` counts toward Rewards tracks.
- **Still required:** paste `firestore.rules` to Console; live test (signin → chest visible → ad → +2-10 → 1h cooldown blocks → 3h drip glows → chip shows `$ + DIA` → profile Diamonds + history).
