// Data for Phases 4 & 5 — admin / marketplace / social / AI

// ===== Admin =====
window.MM.ADMIN = {
  name: "Vivek Nair",
  initials: "VN",
  role: "Platform admin",
  city: "Bengaluru",
};

window.MM.ADMIN_KPIS = {
  gmv_mtd:        { label: "GMV — month to date", value: 4_82_50_000, delta: "+18.2%", trend: "up", spark: [12, 18, 14, 22, 19, 28, 25, 34, 30, 42, 38, 48] },
  active_jobs:    { label: "Active jobs",         value: 312,         delta: "+24",     trend: "up", spark: [180, 210, 198, 240, 260, 255, 280, 290, 285, 300, 308, 312] },
  freelancers:    { label: "Active freelancers",  value: 1840,        delta: "+96",     trend: "up", spark: [1500, 1580, 1620, 1690, 1700, 1720, 1750, 1780, 1790, 1820, 1830, 1840] },
  escrow_held:    { label: "Escrow held",         value: 38_42_000,   delta: "+₹4.2L",   trend: "up", spark: [22, 24, 28, 31, 30, 33, 35, 36, 35, 37, 38, 38.42] },
};

window.MM.ADMIN_ACTIVITY = [
  { id: "a1", type: "signup",   actor: "Riya Banerjee",     meta: "Freelancer · Kolkata",          time: "2m ago",  icon: "user" },
  { id: "a2", type: "release",  actor: "Tilak Weaves → Rohan Pillai", meta: "₹22,000 released · Logo refresh", time: "8m ago", icon: "rupee" },
  { id: "a3", type: "dispute",  actor: "Saanvi Agro",       meta: "Dispute opened · ₹18,500 · 'Delivery scope'", time: "21m ago", icon: "shield", flag: true },
  { id: "a4", type: "nego",     actor: "Aditi Rao ↔ Arjun Mehta",     meta: "Round 4 · ₹34,000 awaiting approval", time: "44m ago", icon: "chat", flag: true },
  { id: "a5", type: "topup",    actor: "Kindred",           meta: "Razorpay top-up · ₹2,00,000",   time: "1h ago",  icon: "wallet" },
  { id: "a6", type: "signup",   actor: "Filter Coffee Co.", meta: "Client · Chennai",              time: "2h ago",  icon: "user" },
  { id: "a7", type: "complete", actor: "Bombay Roastery",   meta: "Job completed · Brand film",    time: "3h ago",  icon: "check" },
  { id: "a8", type: "flag",     actor: "@reels_kiran",      meta: "Profile flagged · suspected fake portfolio", time: "5h ago", icon: "shield", flag: true },
];

window.MM.ADMIN_USERS = [
  { id: "u01", name: "Priya Sharma",     initials: "PS", role: "Client",     org: "Tilak Weaves",        city: "Varanasi",  joined: "Aug 2025", status: "active",  spend: 1_28_500, kyc: "verified" },
  { id: "u02", name: "Arjun Mehta",      initials: "AM", role: "Freelancer", org: "Independent",          city: "Mumbai",    joined: "Mar 2024", status: "active",  spend: 5_42_000, kyc: "verified", rating: 4.92 },
  { id: "u03", name: "Kavya Iyer",       initials: "KI", role: "Freelancer", org: "Kavya Studio",         city: "Bengaluru", joined: "Jan 2024", status: "active",  spend: 8_18_500, kyc: "verified", rating: 4.95 },
  { id: "u04", name: "Aditi Rao",        initials: "AR", role: "Client",     org: "Kindred",              city: "Bengaluru", joined: "Feb 2025", status: "active",  spend: 3_60_000, kyc: "verified" },
  { id: "u05", name: "Rohan Pillai",     initials: "RP", role: "Freelancer", org: "Independent",          city: "Goa",       joined: "Sep 2024", status: "active",  spend: 2_84_000, kyc: "verified", rating: 4.85 },
  { id: "u06", name: "Karthik S.",       initials: "KS", role: "Client",     org: "Filter Coffee Co.",    city: "Chennai",   joined: "Today",    status: "pending", spend:     0,    kyc: "pending" },
  { id: "u07", name: "Vikram Joshi",     initials: "VJ", role: "Freelancer", org: "Joshi Films",          city: "Mumbai",    joined: "Jun 2024", status: "active",  spend: 4_12_000, kyc: "verified", rating: 4.78 },
  { id: "u08", name: "@reels_kiran",     initials: "RK", role: "Freelancer", org: "Independent",          city: "Pune",      joined: "Oct 2026", status: "flagged", spend: 12_500,   kyc: "rejected", rating: 3.2 },
  { id: "u09", name: "Saanvi Agro",      initials: "SA", role: "Client",     org: "Saanvi Agro Foods",    city: "Indore",    joined: "May 2025", status: "active",  spend: 92_000,   kyc: "verified" },
  { id: "u10", name: "Rhea Kapoor",      initials: "RK", role: "Client",     org: "Olio Skincare",        city: "Delhi",     joined: "Jul 2025", status: "active",  spend: 2_24_000, kyc: "verified" },
  { id: "u11", name: "Anveshana Studio", initials: "AS", role: "Client",     org: "Anveshana",            city: "Hyderabad", joined: "Sep 2025", status: "active",  spend: 1_82_000, kyc: "verified" },
  { id: "u12", name: "Sneha Pawar",      initials: "SP", role: "Freelancer", org: "Independent",          city: "Pune",      joined: "Nov 2025", status: "suspended", spend: 0, kyc: "verified", rating: 4.1 },
];

window.MM.ADMIN_NEGOTIATIONS = [
  {
    id: "an_001",
    job: "Brand film — Kindred launch",
    client: { name: "Aditi Rao", initials: "AR", org: "Kindred" },
    freelancer: { name: "Arjun Mehta", initials: "AM" },
    rounds: 4,
    max_rounds: 5,
    final_price: 34_000,
    original_budget: 40_000,
    delivery_days: 14,
    flagged_reason: "Both parties agreed in round 4 — final round used outside standard window (auto-flagged for review).",
    submitted: "44m ago",
    history: [
      { who: "client",      price: 30_000, days: 12, msg: "Budget at 30k. Need delivery in 12 days." },
      { who: "freelancer",  price: 38_000, days: 16, msg: "Standard for brand film is 38k. 16 days is realistic." },
      { who: "client",      price: 32_000, days: 14, msg: "We can stretch to 32k. 14 days works." },
      { who: "freelancer",  price: 34_000, days: 14, msg: "Meeting at 34k. Will lock the calendar today." },
    ],
  },
  {
    id: "an_002",
    job: "Product shoot — Olio SPF range",
    client: { name: "Rhea Kapoor", initials: "RK", org: "Olio Skincare" },
    freelancer: { name: "Kavya Iyer", initials: "KI" },
    rounds: 3,
    max_rounds: 5,
    final_price: 48_500,
    original_budget: 50_000,
    delivery_days: 10,
    flagged_reason: "First-time client over ₹40k — manual approval required.",
    submitted: "2h ago",
    history: [
      { who: "client",      price: 45_000, days: 12, msg: "8 hero + 24 catalogue. Open to your suggestions on lighting." },
      { who: "freelancer",  price: 52_000, days: 10, msg: "I can deliver faster but I'll need to schedule a studio. 52k covers that." },
      { who: "client",      price: 48_500, days: 10, msg: "Let's split the difference at 48.5k." },
    ],
  },
  {
    id: "an_003",
    job: "Reel pack — Anveshana Diwali",
    client: { name: "Anveshana Studio", initials: "AS", org: "Anveshana" },
    freelancer: { name: "Vikram Joshi", initials: "VJ" },
    rounds: 5,
    max_rounds: 5,
    final_price: 28_000,
    original_budget: 22_000,
    delivery_days: 9,
    flagged_reason: "Reached max rounds — platform cap policy review.",
    submitted: "yesterday",
    history: [
      { who: "client",     price: 18_000, days: 7,  msg: "Budget is 18k, 7 days." },
      { who: "freelancer", price: 32_000, days: 12, msg: "Festive rush — minimum I can do is 32k." },
      { who: "client",     price: 22_000, days: 10, msg: "22k, 10 days?" },
      { who: "freelancer", price: 30_000, days: 10, msg: "30k with 10 days." },
      { who: "client",     price: 28_000, days: 9,  msg: "Final at 28k, 9 days." },
    ],
  },
];

window.MM.PLATFORM_WALLET = {
  total_escrow: 38_42_000,
  available_balance: 1_24_85_000,
  pending_payouts: 18_42_000,
  fees_mtd: 6_82_500,
  recent_movements: [
    { id: "m1", type: "topup",    actor: "Kindred",          amt:  2_00_000, time: "1h",  ref: "rzp_8s9d2j" },
    { id: "m2", type: "escrow",   actor: "Tilak Weaves",     amt:    45_000, time: "3h",  ref: "esc_j_003" },
    { id: "m3", type: "release",  actor: "→ Rohan Pillai",   amt:  -22_000, time: "5h",  ref: "rel_j_005" },
    { id: "m4", type: "payout",   actor: "→ Arjun Mehta",    amt:  -18_500, time: "6h",  ref: "po_2026_142" },
    { id: "m5", type: "topup",    actor: "Aditi Rao",        amt:    50_000, time: "8h",  ref: "rzp_aj2k3l" },
    { id: "m6", type: "fee",      actor: "Platform fee · 8%", amt:    3_840,  time: "8h",  ref: "fee_a8s9d" },
    { id: "m7", type: "refund",   actor: "Saanvi Agro",      amt:    12_000, time: "1d",  ref: "ref_disp01" },
  ],
};

// ===== Marketplace browse (client-side) =====
window.MM.MARKETPLACE_FREELANCERS = [
  { id: "mf01", name: "Arjun Mehta",     initials: "AM", tagline: "Reels & brand films editor",     city: "Mumbai",    level: "Top rated",  rating: 4.92, reviews: 142, starts: 4500,  responseHrs: 1,   skills: ["Reels", "Brand films", "Color grade"],   tools: ["Premiere", "AE"],          online: true,  swatch: "linear-gradient(135deg, #1B2128, #4A535E)", category: "Video" },
  { id: "mf02", name: "Kavya Iyer",      initials: "KI", tagline: "Product & fashion photographer", city: "Bengaluru", level: "Top rated",  rating: 4.95, reviews: 89,  starts: 12000, responseHrs: 2,   skills: ["Product photo", "Studio", "Retouching"], tools: ["C1", "PS"],                online: true,  swatch: "linear-gradient(135deg, #B4434E, #6B2530)", category: "Photo" },
  { id: "mf03", name: "Rohan Pillai",    initials: "RP", tagline: "Brand designer · identity systems", city: "Goa",     level: "Top rated",  rating: 4.85, reviews: 64,  starts: 18000, responseHrs: 4,   skills: ["Branding", "Logo", "Typography"],         tools: ["Illustrator", "Figma"],   online: false, swatch: "linear-gradient(135deg, #D97706, #92400E)", category: "Brand" },
  { id: "mf04", name: "Vikram Joshi",    initials: "VJ", tagline: "Documentary & brand filmmaker",  city: "Mumbai",    level: "Top rated",  rating: 4.78, reviews: 51,  starts: 22000, responseHrs: 3,   skills: ["Documentary", "Direction", "Sound"],      tools: ["FCP", "Resolve"],         online: true,  swatch: "linear-gradient(135deg, #2A6C5C, #133E33)", category: "Video" },
  { id: "mf05", name: "Sneha Pawar",     initials: "SP", tagline: "Social media manager & copywriter", city: "Pune",   level: "Rising",     rating: 4.65, reviews: 28,  starts: 8000,  responseHrs: 1,   skills: ["Social", "Copywriting", "Strategy"],      tools: ["Notion", "Buffer"],       online: true,  swatch: "linear-gradient(135deg, #6D28D9, #2E1065)", category: "Copy" },
  { id: "mf06", name: "Aakash Verma",    initials: "AV", tagline: "Motion designer · 2D & 3D",       city: "Delhi",     level: "Top rated",  rating: 4.88, reviews: 73,  starts: 14000, responseHrs: 6,   skills: ["Motion", "2D anim", "3D"],                tools: ["AE", "Cinema 4D"],        online: false, swatch: "linear-gradient(135deg, #0369A1, #082F49)", category: "Motion" },
  { id: "mf07", name: "Tara Nair",       initials: "TN", tagline: "Web designer · D2C landing pages", city: "Bengaluru", level: "Rising",    rating: 4.72, reviews: 34,  starts: 16000, responseHrs: 4,   skills: ["Web", "Landing pages", "Shopify"],        tools: ["Figma", "Webflow"],       online: true,  swatch: "linear-gradient(135deg, oklch(0.62 0.13 165), oklch(0.42 0.09 165))", category: "Web" },
  { id: "mf08", name: "Devansh Kapoor",  initials: "DK", tagline: "Illustrator · packaging & editorial", city: "Jaipur", level: "Top rated", rating: 4.91, reviews: 58,  starts: 10000, responseHrs: 12,  skills: ["Illustration", "Packaging", "Editorial"], tools: ["Procreate", "Illustrator"], online: false, swatch: "linear-gradient(135deg, #C68A2E, #8A5A2B)", category: "Illustration" },
  { id: "mf09", name: "Meera Krishnan",  initials: "MK", tagline: "Voiceover artist · 3 languages",  city: "Chennai",   level: "Rising",     rating: 4.58, reviews: 22,  starts: 3500,  responseHrs: 2,   skills: ["VO", "Narration", "Ads"],                 tools: ["Audacity"],               online: true,  swatch: "linear-gradient(135deg, #B91C1C, #7F1D1D)", category: "Audio" },
];

window.MM.MARKETPLACE_CATEGORIES = [
  { key: "all",          label: "All",            icon: "layers" },
  { key: "Video",        label: "Video",          icon: "video" },
  { key: "Photo",        label: "Photography",    icon: "image" },
  { key: "Brand",        label: "Branding",       icon: "sparkles" },
  { key: "Motion",       label: "Motion",         icon: "zap" },
  { key: "Web",          label: "Web",            icon: "type" },
  { key: "Illustration", label: "Illustration",   icon: "edit" },
  { key: "Copy",         label: "Copywriting",    icon: "type" },
  { key: "Audio",        label: "Audio · VO",     icon: "microphone" },
];

// ===== Social media publisher =====
window.MM.SOCIAL_ACCOUNTS = [
  { id: "s1", platform: "instagram", handle: "@tilakweaves",       followers: "24.8k", connected: true },
  { id: "s2", platform: "facebook",  handle: "Tilak Weaves",       followers: "8.2k",  connected: true },
  { id: "s3", platform: "youtube",   handle: "Tilak Weaves Co.",   followers: "1.4k",  connected: true },
  { id: "s4", platform: "whatsapp",  handle: "Catalog · Business", followers: "—",     connected: false },
];

window.MM.SOCIAL_SCHEDULED = [
  { id: "p1", caption: "Pallu work that takes a week. Watch how. ✨",            when: "Today, 6:30 PM",  platforms: ["instagram", "facebook"], status: "scheduled", media: "video" },
  { id: "p2", caption: "Three drape styles for office, in under 30 seconds.",   when: "Tomorrow, 11:00 AM", platforms: ["instagram"],          status: "scheduled", media: "video" },
  { id: "p3", caption: "Diwali collection drops in 9 days. Set a reminder ↓",   when: "Oct 24, 9:00 AM",  platforms: ["instagram", "facebook", "youtube"], status: "draft", media: "image" },
  { id: "p4", caption: "Inside Varanasi. 4 generations. 1 saree.",              when: "Oct 22, 7:00 PM",  platforms: ["instagram", "youtube"], status: "scheduled", media: "video" },
];

window.MM.SOCIAL_PUBLISHED = [
  { id: "pp1", caption: "Behind the loom — meet Anand-ji.",   when: "Yesterday, 6:00 PM", platforms: ["instagram", "facebook"], reach: "8.4k", likes: 642, comments: 38 },
  { id: "pp2", caption: "How to drape a Banarasi in 4 steps.", when: "Oct 14, 5:30 PM",   platforms: ["instagram"],             reach: "12.1k", likes: 1240, comments: 64 },
  { id: "pp3", caption: "First look — Diwali campaign film.",  when: "Oct 12, 8:00 PM",   platforms: ["instagram", "youtube"], reach: "18.6k", likes: 2280, comments: 142 },
];

// ===== Mint AI =====
window.MM.AI_CAPABILITIES = [
  { id: "cap_copy",    name: "Captions & copy",   icon: "type",     desc: "Captions, hooks, hashtags, scripts — in your brand voice.",       cost: 4,   unit: "per generation" },
  { id: "cap_image",   name: "Product imagery",   icon: "image",    desc: "On-brand product mockups, banners, lifestyle shots.",             cost: 12,  unit: "per image" },
  { id: "cap_video",   name: "Short videos",      icon: "video",    desc: "5–15s product reels, motion ads, kinetic typography.",            cost: 48,  unit: "per video" },
  { id: "cap_voice",   name: "Voice & VO",        icon: "microphone", desc: "Voiceover in 12 Indian languages, 40+ accents.",                 cost: 6,   unit: "per minute" },
  { id: "cap_brief",   name: "Brief assistant",   icon: "sparkles", desc: "Turn a one-liner into a hire-ready brief.",                       cost: 0,   unit: "free" },
  { id: "cap_translate", name: "Translate",       icon: "refresh",  desc: "Translate captions, scripts, web copy to 22 languages.",          cost: 2,   unit: "per language" },
];

window.MM.AI_SUGGESTIONS = [
  "Write 6 caption variants for our Diwali handloom drop, in our calm-warm brand voice.",
  "Generate 3 hook lines for a 15s saree drape reel.",
  "Turn 'we make handloom Banarasis' into a hire-ready brief for a brand film.",
  "Translate this caption to Hindi, Marathi, and Tamil.",
  "Generate a flat-lay product image for the festive collection — paper texture, soft warm light.",
];

window.MM.AI_HISTORY = [
  { id: "h1", title: "Diwali caption pack — calm warm voice",     type: "copy",  time: "12m ago", cost: 4,  output: "6 captions · 18 hashtags" },
  { id: "h2", title: "Brief: 'Bombay Roastery Bandra outlet'",    type: "brief", time: "2h ago",  cost: 0,  output: "Brief 380 words · ready to post" },
  { id: "h3", title: "Product flatlay — Banarasi green/gold",     type: "image", time: "yesterday", cost: 12, output: "1024×1024 PNG · 3 variations" },
  { id: "h4", title: "15s product reel — winter collection",      type: "video", time: "3d ago",  cost: 48, output: "9:16 MP4 · captions burned" },
];
