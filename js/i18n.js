// Favmoney i18n — English + Simplified Chinese, no external service.
// Works offline and behind firewalls (unlike auto-translate widgets).
// Usage in markup: data-i18n="key" (text), data-i18n-html="key" (markup),
// data-i18n-ph="key" (placeholder). Language buttons: any [data-lang] element
// cycles en <-> zh-CN. Emits 'fav-lang' on switch for dynamic content.
// Classic script (no modules): include before main.js / page scripts.
(function () {
  'use strict';
  var KEY = 'fav_lang';
  var STR = {
    en: {
      'nav.signin': 'Sign In', 'nav.signup': 'Sign Up', 'nav.earn': 'Earn', 'nav.grow': 'Grow', 'nav.invite': 'Invite', 'nav.rewards': 'Rewards', 'nav.cashout': 'Cashout',
      'hero.l1': 'Do what you love.', 'hero.l2a': "We'll", 'hero.l2b': 'reward you', 'hero.l2c': 'for it.',
      'hero.sub': 'Favmoney turns playtime into payday. Play mobile games, try new apps, answer quick quizzes and earn cashback on shops you already use.',
      'trust.excellent': 'Excellent 4.6', 'trust.sub': 'TrustScore · member reviews', 'trust.note': 'Loved by early earners worldwide',
      'box.title': 'Sign Up For ', 'box.free': 'Free', 'box.email_ph': 'Enter your email', 'box.email_err': 'Please enter a valid email to continue.', 'box.start': 'Get started for free', 'box.tiny': 'Free forever. No card required. By joining you agree to our Terms & Privacy.',
      'stats.title': 'Built for earners<br />everywhere', 'stats.members': 'Members', 'stats.rating': 'Avg. app rating', 'stats.paid': 'Paid in rewards',
      'how.title': "So what's the catch?<br />Here's the <span class=\"hl\">honest truth.</span>",
      'how.sub': 'No magic. Brands pay to reach real people — we pass most of it back to you.',
      'how.s1t': 'Brands are fighting for your attention',
      'how.s1p': 'Game studios and apps spend billions on ads. Instead of paying ad networks, Favmoney partners pay <b style="color:#fff">you</b> directly to try their games and products for real.',
      'how.feat': 'Featured quests', 'how.featp': 'Hand-picked games with milestone payouts, refreshed daily.', 'how.browse': 'Browse all quests ',
      'how.matched': 'Matched for you', 'how.matchedp': "Tell us what you like once — we surface games and quizzes you'll actually enjoy.",
      'how.s2t': "We match you with stuff you'll actually like",
      'how.s2p': "Puzzle, merge, strategy, RPG, quizzes, cashback — pick what fits your vibe. If you don't love it, skip it. Nothing works unless you genuinely enjoy it.",
      'how.s3t': "Do what you'd do anyway. Get paid.",
      'how.s3p': 'Hit milestones, clear quizzes, shop with cashback. Not a salary — real pocket money for downtime you already spend on your phone.',
      'how.split': 'How payouts split', 'how.splitp': "Brands fund the pool. We keep a small margin, you keep the lion's share.",
      'earnsec.title': 'Earn from what you <span class="hl">already do.</span>',
      'earnsec.sub': "Hundreds of quests, one wallet. Start free, cash out when you're ready.",
      'earnsec.g1t': "Whatever you're into, there's a game for it",
      'earnsec.g1p': 'Puzzle, solitaire, arcade, RPG, shooters and more. Earn as you clear real milestones — no grinding for pennies.',
      'earnsec.g1a': 'Up to $120 / game', 'earnsec.g1b': 'New titles weekly', 'earnsec.g1c': 'No deposit',
      'earnsec.g2t': 'Test your brain, earn per answer',
      'earnsec.g2p': 'One free quiz session daily, plus bonus sessions via short ads. Every correct answer pays $0.10.',
      'earnsec.g2a': '$0.10 / answer', 'earnsec.g2b': '3 min avg', 'earnsec.g2c': 'Play Quiz & Earn ',
      'earnsec.g3t': 'Shop & earn cashback',
      'earnsec.g3p': 'Start from Favmoney, shop as normal, watch a slice come back to your balance automatically.',
      'earnsec.g3a': 'Up to 12% back', 'earnsec.g3b': '100+ stores', 'earnsec.g3c': 'See stores ',
      'rew.title': 'Rewards, your way.<br /><span class="hl">Pick from many options.</span>',
      'rew.sub': 'Cash, crypto or gift cards — low minimums, fast processing, no points maze.',
      'rev.title': 'Real reviews from real<br /><span class="hl">people like you.</span>',
      'rev.sub': "Unedited member stories. Your mileage varies — that's the honest part.",
      'rev.donna_t': 'Pays for my extras', 'rev.donna_p': 'I play on my phone anyway, so why not get paid? I cash out for gift cards for little treats outside my budget.',
      'rev.michael_t': 'Patient and it pays', 'rev.michael_p': 'Honest and easy to use. Be patient with payouts and verification — a few bucks here and there adds up.',
      'rev.bri_t': 'Way better than expected', 'rev.bri_p': "I was skeptical. Legit rewards if you play consistently — best UI of any earning app I've tried.",
      'rev.annie_t': 'Small amounts, nicely', 'rev.annie_p': "Won't make you a millionaire but builds up nicely. Payout was prompt — I save for Amazon treats.",
      'rev.steph_t': 'Fun games anyway', 'rev.steph_p': "Fun games you'd play anyway. Might as well make a little change on the side.",
      'rev.exc_t': 'Helps with little bills', 'rev.exc_p': 'Four months in. Not life-changing, but it covers little expenses. Great for unwinding after work.',
      'rev.dunes_t': 'Best rewards app tried', 'rev.dunes_p': "Payouts, rewards and games are much better than other apps I've tried. Highly recommended.",
      'rev.benny_t': 'Daily quests rule', 'rev.benny_p': 'Love how it tracks daily quests. The promoted games are actually good too.',
      'rev.zoe_t': 'Literally fav money', 'rev.zoe_p': "If you put real time into the games, it's worth the payout. Name checks out.",
      'counter.title': 'Make your everyday<br /><span class="hl">more rewarding.</span>',
      'counter.sub': '$2.4M+ in rewards paid to real humans. We counted. Twice.',
      'counter.methods': 'PayPal · gift cards · crypto · minimums from $20',
      'faq.title': 'Still skeptical? Fair.<br /><span class="hl">We\'ve got answers.</span>',
      'faq.q1': 'Does Favmoney actually pay out?',
      'faq.a1': 'Yes. Rewards are funded by brand partners and paid via PayPal, gift cards and crypto once you hit the minimum (PayPal $20 · crypto $25 · others $30). PayPal typically lands same-day after review; gift codes arrive by email within minutes to hours. Some payouts are briefly held for anti-fraud checks — that protects the pool for real earners.',
      'faq.q2': "Will I get rich, and what's the catch?",
      'faq.a2': "No — and run from anyone promising that. Think coffee-and-takeaway money, not a salary. Most members earn a few dollars to ~$50/month depending on time and quests picked. The honest trade-off is time: quests take real play. Pick games you'd enjoy anyway, dip in during downtime, never feel locked in.",
      'faq.q3': 'Why do some rewards get reviewed or declined?',
      'faq.a3': "Because the pool is shared. If we paid every claim blindly, bots would drain it. We review completions, device signals and offer callbacks. Finish quests yourself, on one account, without VPNs or manipulated installs, and you'll be fine. Reviews keep payouts flowing to real humans.",
      'faq.q4': 'Is it really free, and how does Favmoney make money?',
      'faq.a4': "Joining is free forever — no card, no subscription. Brands pay us to bring real, engaged users; we keep a margin and return the larger share to you as rewards. The bigger Favmoney gets, the more we can give back. That's the whole model.",
      'faq.q5': 'What happens with my data?',
      'faq.a5': 'We never sell your data. We use it to match quests, keep rewards fair and stop fraud. See our Privacy Policy for details, and Terms for payout rules.',
      'final.title': 'Ready to get rewarded<br />for playtime?',
      'final.sub': 'Join free in 30 seconds. Pick a game tonight, earn your first bucks this week.',
      'final.cta': 'Claim your free account', 'final.tiny': 'Free forever · No card · Cancel anytime',
      'foot.tag': 'Favmoney is where playtime pays. Complete games, quizzes and cashback quests, then cash out fast.',
      'foot.rating': 'Excellent · Community rating 4.6',
      'foot.h1': 'Favmoney', 'foot.h2': 'Earn', 'foot.h3': 'Resources', 'foot.h4': 'Company',
      'foot.cashout': 'Cashout', 'foot.gift': 'Gift cards', 'foot.crypto': 'Crypto payouts', 'foot.reviews': 'Reviews',
      'foot.games': 'Play games', 'foot.quiz': 'Quiz & Earn', 'foot.cashback': 'Cashback', 'foot.how': 'How it works',
      'foot.faq': 'FAQ', 'foot.join': 'Join free', 'foot.about': 'About', 'foot.trust': 'Trust & safety',
      'foot.contact': 'Contact', 'foot.quests': 'All quests',
      'earn.title': 'Earn', 'earn.sub': 'Play games, answer quizzes, earn cashback. New quests drop daily.', 'earn.choose': 'Choose how you earn',
      'earn.offers.title': 'Offers & Apps', 'earn.hot': 'Hot', 'earn.pay.upto': 'Up to ',
      'earn.offers.desc': 'Download mobile games, test new applications, and reach milestones to earn big rewards.',
      'earn.time.avg': 'Avg. Time', 'earn.time.35': '35 mins per offer', 'earn.cta.earn': 'Earn Now ',
      'earn.prov2.title': 'CPA Grip Offers', 'earn.prov2.desc': 'Complete CPA Grip surveys and app offers — you keep 70% of each approved payout.',
      'earn.gg.title': 'Golden Goose', 'earn.gg.desc': 'Complete mobile offers from gg.agency — you keep 70% of each approved payout.',
      'earn.ml.title': 'MyLead', 'earn.ml.desc': 'Complete offerwall deals from mylead.global — you keep 70% of each approved payout.',
      'earn.ads.title': 'Watch Ads', 'earn.ads.tag': 'PTC', 'earn.ads.pay': 'Instant Coins',
      'earn.ads.desc': 'Watch short video advertisements and promotional clips to accumulate balance continuously.',
      'earn.ads.time': '30 sec - 2 mins', 'earn.ads.cta': 'Watch Now ',
      'earn.quiz.title': 'Quiz & Earn', 'earn.quiz.tag': 'Study', 'earn.quiz.per': ' / answer',
      'earn.quiz.desc': 'One free session daily, plus 10 bonus sessions via short ads — solve 30 math sprints against the clock, every correct answer pays cash.',
      'earn.quiz.limit': 'Limit', 'earn.quiz.limitv': '1 free daily', 'earn.quiz.cta': 'Start Quiz ',
      'earn.faucet.title': 'Free Faucet', 'earn.faucet.pay': 'Free Claims',
      'earn.faucet.desc': 'Claim free coin rewards every hour — 10 drips per batch, 4 batches a day.',
      'earn.faucet.status': 'Status', 'earn.faucet.cta': 'Claim Now ',
      'earn.spin.title': 'Spin the Wheel', 'earn.spin.tag': 'Bonus', 'earn.spin.upto': 'Win Up to ',
      'earn.spin.desc': 'Spin the daily prize wheel to win random balance multipliers and jackpot bonus points.',
      'earn.spin.limit': 'Limit', 'earn.spin.limitv': '1 spin daily', 'earn.spin.cta': 'Spin Wheel ',
      'signup.title': 'Create your account', 'signup.email': 'Email', 'signup.pass': 'Password',
      'signup.country': 'Country', 'signup.country_err': 'Please choose your country.',
      'signup.ref': 'Referral code', 'signup.refbonus': '— get $1.00 instantly',
      'signup.refhint': "Have a friend's code? Enter it for a $1.00 instant bonus. Your friend gets $0.50 instantly.",
      'signup.go': 'Create free account',
      'signup.agree': 'By continuing you agree to Terms and Privacy. Already have one? ',
      'signup.rules': 'Prohibited: multiple accounts, completing offers on another user\'s account, or any VPN, VPS or emulator software.'
    },
    'zh-CN': {
      'nav.signin': '登录', 'nav.signup': '注册', 'nav.earn': '赚钱', 'nav.grow': '增长', 'nav.invite': '邀请', 'nav.rewards': '奖励', 'nav.cashout': '提现',
      'hero.l1': '做你热爱的事。', 'hero.l2a': '我们将', 'hero.l2b': '奖励你', 'hero.l2c': '',
      'hero.sub': 'Favmoney 让娱乐时间变成收入。玩手机游戏、试用新应用、答趣味问答，还能在常去的商店拿返现。',
      'trust.excellent': '优秀 4.6', 'trust.sub': 'TrustScore · 会员评价', 'trust.note': '深受全球早期赚友喜爱',
      'box.title': '', 'box.free': '免费注册', 'box.email_ph': '输入您的邮箱', 'box.email_err': '请输入有效的邮箱以继续。', 'box.start': '免费开始', 'box.tiny': '永久免费。无需银行卡。注册即表示同意我们的条款与隐私政策。',
      'stats.title': '为全球赚友<br />而打造', 'stats.members': '会员', 'stats.rating': '应用平均评分', 'stats.paid': '累计发放奖励',
      'how.title': '有什么猫腻？<br /><span class="hl">说说真心话。</span>',
      'how.sub': '没有魔法。品牌花钱触达真实用户——我们把大部分返还给你。',
      'how.s1t': '品牌正在争夺你的注意力',
      'how.s1p': '游戏工作室和应用每年在广告上花费数十亿。与其把钱给广告网络，Favmoney 合作品牌直接付钱给你，让你真实体验他们的游戏和产品。',
      'how.feat': '精选任务', 'how.featp': '精选手游里程碑奖励，每日更新。', 'how.browse': '浏览全部任务 ',
      'how.matched': '为你匹配', 'how.matchedp': '告诉我们你的喜好一次——为你推荐真正喜欢的游戏和问答。',
      'how.s2t': '为你匹配真正喜欢的内容',
      'how.s2p': '解谜、合成、策略、RPG、问答、返现——选择适合你的氛围。不喜欢就跳过，只有真正喜欢才有效。',
      'how.s3t': '做本来就做的事，赚钱。',
      'how.s3p': '达成里程碑、通过问答、用返现购物。这不是工资——而是把本来花在手机上的碎片时间变成真正的零花钱。',
      'how.split': '奖励如何分配', 'how.splitp': '品牌出资建立奖池。我们只保留少量利润，大头归你。',
      'earnsec.title': '从你<span class="hl">本来就做的事</span>中赚钱。',
      'earnsec.sub': '数百个任务，一个钱包。免费开始，随时提现。',
      'earnsec.g1t': '无论喜欢什么，都有适合你的游戏',
      'earnsec.g1p': '解谜、纸牌、街机、RPG、射击等。达成真实里程碑即赚钱——拒绝廉价刷量。',
      'earnsec.g1a': '单个游戏最高 $120', 'earnsec.g1b': '每周上新', 'earnsec.g1c': '无需押金',
      'earnsec.g2t': '动脑答题，按题赚钱',
      'earnsec.g2p': '每日一次免费问答，另可通过短广告获得额外场次。每答对一题赚 $0.10。',
      'earnsec.g2a': '$0.10 / 题', 'earnsec.g2b': '平均 3 分钟', 'earnsec.g2c': '开始答题 ',
      'earnsec.g3t': '购物赚返现',
      'earnsec.g3p': '从 Favmoney 出发照常购物，返现自动回到你的余额。',
      'earnsec.g3a': '最高返 12%', 'earnsec.g3b': '100+ 商家', 'earnsec.g3c': '查看商家 ',
      'rew.title': '奖励随心选。<br /><span class="hl">多种方式任你挑。</span>',
      'rew.sub': '现金、加密货币或礼品卡——低门槛、到账快，没有积分迷宫。',
      'rev.title': '来自真实用户<br /><span class="hl">的真实评价。</span>',
      'rev.sub': '未经编辑的会员故事。体验因人而异——这才是实在话。',
      'rev.donna_t': '补贴我的小开销', 'rev.donna_p': '反正平时也在手机上玩，为什么不顺便赚钱？我提现礼品卡，给预算外的小确幸买单。',
      'rev.michael_t': '有耐心就有回报', 'rev.michael_p': '诚实易用。对提现和审核多点耐心——小钱积少成多。',
      'rev.bri_t': '远超预期', 'rev.bri_p': '一开始我也怀疑。坚持玩奖励真实到账——用过的赚钱应用里体验最好。',
      'rev.annie_t': '细水长流', 'rev.annie_p': '发不了财，但稳定积累。提现到账很快——我攒着换亚马逊福利。',
      'rev.steph_t': '反正游戏好玩', 'rev.steph_p': '本来就是爱玩的游戏，顺手赚点零花。',
      'rev.exc_t': '补贴小账单', 'rev.exc_p': '玩了四个月。改变不了生活，但小开销有着落了。下班放松的好选择。',
      'rev.dunes_t': '用过最好的奖励应用', 'rev.dunes_p': '提现、奖励和游戏都比用过的其他应用好得多。强烈推荐。',
      'rev.benny_t': '每日任务太棒了', 'rev.benny_p': '喜欢每日任务的追踪方式。推荐的游戏本身质量也很好。',
      'rev.zoe_t': '名副其实', 'rev.zoe_p': '真投入时间玩游戏，回报对得起付出。名字没起错。',
      'counter.title': '让每一天<br /><span class="hl">更有收获。</span>',
      'counter.sub': '已向真实用户发放 $240万+ 奖励。我们数过两遍。',
      'counter.methods': 'PayPal · 礼品卡 · 加密货币 · $20 起提',
      'faq.title': '还有疑问？正常。<br /><span class="hl">我们有答案。</span>',
      'faq.q1': 'Favmoney 真的会打钱吗？',
      'faq.a1': '会。奖励由品牌合作方出资，达到门槛后通过 PayPal、礼品卡和加密货币发放（PayPal $20 · 加密货币 $25 · 其他 $30）。PayPal 审核后通常当天到账；礼品卡几分钟到几小时内发到邮箱。部分提现会短暂风控审核——这是为了保护真实赚友的奖池。',
      'faq.q2': '能发财吗，有什么坑？',
      'faq.a2': '不能——承诺发财的快跑。把它看作咖啡零食钱，不是工资。大多数会员每月赚几美元到约 $50，取决于投入时间和任务选择。诚实的代价是时间：任务需要真实游玩。选本来就喜欢的游戏，利用碎片时间玩，永远不要有被套牢的感觉。',
      'faq.q3': '为什么有的奖励会被审核或拒绝？',
      'faq.a3': '因为奖池是共有的。如果闭眼打钱，机器人会掏空它。我们会审核完成情况、设备信号和渠道回调。自己做任务、一人一号，不用 VPN 或篡改安装，就没问题。审核让奖励持续流向真人。',
      'faq.q4': '真的免费吗，Favmoney 靠什么赚钱？',
      'faq.a4': '注册永久免费——无银行卡、无订阅。品牌付费让我们带来真实活跃用户；我们保留少量利润，把大头以奖励返还给你。Favmoney 越大，能回馈的就越多。这就是全部模式。',
      'faq.q5': '我的数据会怎样？',
      'faq.a5': '我们绝不出售你的数据。数据仅用于匹配任务、保证奖励公平和反作弊。详见隐私政策，提现规则见服务条款。',
      'final.title': '准备好让娱乐时间<br />产生回报了吗？',
      'final.sub': '30 秒免费加入。今晚选个游戏，本周赚到第一笔。',
      'final.cta': '领取免费账户', 'final.tiny': '永久免费 · 无需银行卡 · 随时取消',
      'foot.tag': 'Favmoney 让娱乐时间变现。完成游戏、问答和返现任务，快速提现。',
      'foot.rating': '优秀 · 社区评分 4.6',
      'foot.h1': 'Favmoney', 'foot.h2': '赚钱', 'foot.h3': '资源', 'foot.h4': '公司',
      'foot.cashout': '提现', 'foot.gift': '礼品卡', 'foot.crypto': '加密货币提现', 'foot.reviews': '评价',
      'foot.games': '玩游戏', 'foot.quiz': '答题赚钱', 'foot.cashback': '返现', 'foot.how': '怎么玩',
      'foot.faq': '常见问题', 'foot.join': '免费加入', 'foot.about': '关于我们', 'foot.trust': '信任与安全',
      'foot.contact': '联系我们', 'foot.quests': '全部任务',
      'earn.title': '赚钱', 'earn.sub': '玩游戏、答问卷、赚返现。新任务每日上新。', 'earn.choose': '选择你的赚钱方式',
      'earn.offers.title': '优惠与应用', 'earn.hot': '热门', 'earn.pay.upto': '最高 ',
      'earn.offers.desc': '下载手机游戏、试用新应用、达成里程碑赢大奖。',
      'earn.time.avg': '平均用时', 'earn.time.35': '每个任务 35 分钟', 'earn.cta.earn': '立即赚钱 ',
      'earn.prov2.title': 'CPA Grip 任务', 'earn.prov2.desc': '完成 CPA Grip 问卷和应用任务——每笔审核通过的奖励你拿 70%。',
      'earn.gg.title': 'Golden Goose', 'earn.gg.desc': '完成 gg.agency 手机任务——每笔审核通过的奖励你拿 70%。',
      'earn.ml.title': 'MyLead', 'earn.ml.desc': '完成 mylead.global 任务墙——每笔审核通过的奖励你拿 70%。',
      'earn.ads.title': '看广告', 'earn.ads.tag': 'PTC', 'earn.ads.pay': '即时到账',
      'earn.ads.desc': '看短视频广告和推广视频，余额持续增长。',
      'earn.ads.time': '30 秒 - 2 分钟', 'earn.ads.cta': '立即观看 ',
      'earn.quiz.title': '答题赚钱', 'earn.quiz.tag': '学习', 'earn.quiz.per': ' / 每题',
      'earn.quiz.desc': '每日一次免费场次，另有 10 次短广告奖励场次——30 道数学竞速，答对即有现金。',
      'earn.quiz.limit': '名额', 'earn.quiz.limitv': '每日免费 1 次', 'earn.quiz.cta': '开始答题 ',
      'earn.faucet.title': '免费水龙头', 'earn.faucet.pay': '免费领取',
      'earn.faucet.desc': '每小时免费领币——每批 10 次，每日 4 批。',
      'earn.faucet.status': '状态', 'earn.faucet.cta': '立即领取 ',
      'earn.spin.title': '幸运大转盘', 'earn.spin.tag': '福利', 'earn.spin.upto': '最高赢 ',
      'earn.spin.desc': '每日转动奖励轮盘，赢余额倍数和头奖奖金。',
      'earn.spin.limit': '名额', 'earn.spin.limitv': '每日 1 次', 'earn.spin.cta': '开始转动 ',
      'signup.title': '创建您的账户', 'signup.email': '邮箱', 'signup.pass': '密码',
      'signup.country': '国家/地区', 'signup.country_err': '请选择您的国家/地区。',
      'signup.ref': '推荐码', 'signup.refbonus': '— 立得 $1.00',
      'signup.refhint': '有朋友的推荐码？填入即得 $1.00 即时奖励。你的朋友即时得 $0.50。',
      'signup.go': '创建免费账户',
      'signup.agree': '继续即表示同意服务条款和隐私政策。已有账户？',
      'signup.rules': '禁止行为：多账户、在他人账户下做任务，或使用任何 VPN、VPS、模拟器软件。'
    }
  };
  function lang() {
    try {
      var s = null;
      try { s = localStorage.getItem(KEY); } catch (_) {}
      if (s && STR[s]) return s;
    } catch (_) {}
    try {
      var n = navigator.language || 'en';
      if (/^zh/i.test(n)) return 'zh-CN';
    } catch (_) {}
    return 'en';
  }
  var cur = lang();
  function t(k) {
    var d = STR[cur] || STR.en, v = d[k];
    if (v == null) v = STR.en[k];
    return v == null ? '' : v;
  }
  function paintLangButtons() {
    var label = cur === 'zh-CN' ? '中文' : 'EN';
    try {
      var btns = document.querySelectorAll('[data-lang]');
      for (var i = 0; i < btns.length; i++) {
        var b = btns[i];
        for (var j = b.childNodes.length - 1; j >= 0; j--) {
          if (b.childNodes[j].nodeType === 3) b.removeChild(b.childNodes[j]);
        }
        b.appendChild(document.createTextNode(label));
      }
    } catch (_) {}
  }
  function apply() {
    try { document.documentElement.setAttribute('lang', cur === 'zh-CN' ? 'zh-CN' : 'en'); } catch (_) {}
    try {
      var els = document.querySelectorAll('[data-i18n]');
      for (var i = 0; i < els.length; i++) {
        var k = els[i].getAttribute('data-i18n');
        if (k) els[i].textContent = t(k);
      }
      var h = document.querySelectorAll('[data-i18n-html]');
      for (var j = 0; j < h.length; j++) {
        var kh = h[j].getAttribute('data-i18n-html');
        if (kh) h[j].innerHTML = t(kh);
      }
      var ph = document.querySelectorAll('[data-i18n-ph]');
      for (var m = 0; m < ph.length; m++) {
        var kp = ph[m].getAttribute('data-i18n-ph');
        if (kp) ph[m].setAttribute('placeholder', t(kp));
      }
    } catch (_) {}
    paintLangButtons();
  }
  function setLang(l) {
    if (!STR[l]) return cur;
    cur = l;
    try { localStorage.setItem(KEY, l); } catch (_) {}
    apply();
    try {
      document.dispatchEvent(new CustomEvent('fav-lang', { detail: { lang: l } }));
    } catch (_) {}
    return cur;
  }
  function cycle() {
    return setLang(cur === 'zh-CN' ? 'en' : 'zh-CN');
  }
  function boot() { apply(); }
  try {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
  } catch (_) {}
  var api = { t: t, get: function () { return cur; }, set: setLang, cycle: cycle, apply: apply, LANGS: ['en', 'zh-CN'] };
  try { if (typeof window !== 'undefined') window.FavI18n = api; } catch (_) {}
  try { if (typeof globalThis !== 'undefined') globalThis.FavI18n = globalThis.FavI18n || api; } catch (_) {}
})();
