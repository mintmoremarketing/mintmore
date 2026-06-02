// Sample data - Indian SMB use cases for Mint More
window.MM = window.MM || {};

window.MM.USER = {
  id: "u_001",
  name: "Priya Sharma",
  initials: "PS",
  email: "priya@tilakweaves.in",
  role: "client",
  business: "Tilak Weaves",
  phone: "+91 98765 43210",
};

window.MM.WALLET = {
  available: 12450,
  escrow: 8500,
  currency: "INR",
};

window.MM.JOBS = [
  {
    id: "j_001",
    title: "Diwali campaign hero video for Tilak Weaves",
    category: "Videography",
    status: "matching",
    budget: 35000,
    pricing_mode: "expert",
    deadline: "Nov 02, 2026",
    created: "2 hours ago",
    description: "We need a 60–90 second hero film for our Diwali handloom drop. Should showcase the weaving process, finished sarees on real customers, and our family of artisans in Varanasi. Calm, emotional pacing — not loud.",
    skills: ["Cinematic video", "Storytelling", "Color grading"],
    level: "experienced",
    files: ["brief_v2.pdf", "moodboard.zip"],
    matches_found: 3,
  },
  {
    id: "j_002",
    title: "Instagram reel pack — 6 reels on saree styling",
    category: "Social media",
    status: "negotiating",
    budget: 18000,
    pricing_mode: "budget",
    deadline: "Oct 28, 2026",
    created: "yesterday",
    description: "6 short reels (15–30s each) demonstrating different ways to drape our handloom sarees for working women. Need trending audio, on-screen subtitles, brand watermark.",
    skills: ["Reels editing", "Trending audio", "Captions"],
    level: "intermediate",
    files: ["shotlist.pdf"],
    matched_freelancer: {
      name: "Arjun Mehta",
      initials: "AM",
      tagline: "Reels editor • Mumbai",
      level: "Top rated",
      rating: 4.9,
      reviews: 142,
    },
    rounds: [
      { who: "them", price: 22000, days: 9, message: "I'd love to take this on. My standard for a 6-reel pack with trending audio + captions is ₹22k. Can deliver in 9 days." },
      { who: "me",   price: 19000, days: 10, message: "Budget is tight on our end — can we land at ₹19k? Extra day is fine. Loved your saree drape reel for Kalki." },
      { who: "them", price: 20500, days: 9, message: "Meet in the middle at ₹20.5k and I'll throw in a bonus 15s teaser for your stories." },
    ],
    current_round: 4,
    max_rounds: 5,
  },
  {
    id: "j_003",
    title: "Product photoshoot — handloom winter collection",
    category: "Photography",
    status: "in_progress",
    budget: 45000,
    pricing_mode: "budget",
    deadline: "Oct 22, 2026",
    created: "5 days ago",
    description: "Studio + outdoor shoot for our winter handloom collection. 12 looks, 6 hero shots, 30 catalogue shots.",
    skills: ["Product photography", "Studio lighting", "Retouching"],
    level: "experienced",
    files: ["shotlist_winter.pdf", "references.zip"],
    matched_freelancer: {
      name: "Kavya Iyer",
      initials: "KI",
      tagline: "Product & fashion photographer • Bengaluru",
      level: "Top rated",
      rating: 4.95,
      reviews: 89,
    },
    escrowed: 45000,
    progress: 65,
    messages: [
      { who: "them", text: "Shoot is wrapped! Currently retouching the hero set. Will send proofs tomorrow.", time: "10:42 AM" },
      { who: "me",   text: "Beautiful — the look 3 reference came out so well. Any chance we can add a couple of detail shots of the pallu work?", time: "10:48 AM" },
      { who: "them", text: "Yes, I shot a bunch on the side just in case. Will include them in proofs.", time: "10:51 AM" },
      { who: "me",   text: "Perfect. You're a star.", time: "10:51 AM" },
    ],
  },
  {
    id: "j_004",
    title: "Festive landing page copy + product descriptions",
    category: "Copywriting",
    status: "draft",
    budget: 8000,
    pricing_mode: "budget",
    deadline: "Oct 18, 2026",
    created: "today",
    description: "Landing page + 24 product descriptions for the Diwali drop. Warm, descriptive, not corny.",
    skills: ["Copywriting", "D2C", "SEO"],
    level: "intermediate",
  },
  {
    id: "j_005",
    title: "Logo refresh for Tilak Weaves",
    category: "Branding",
    status: "completed",
    budget: 22000,
    pricing_mode: "budget",
    deadline: "Sep 24, 2026",
    created: "3 weeks ago",
    description: "Refresh of our 2018 logo. Keep the handloom shuttle motif, modernise the wordmark.",
    skills: ["Brand identity", "Logo design"],
    level: "experienced",
    matched_freelancer: {
      name: "Rohan Pillai",
      initials: "RP",
      tagline: "Brand designer • Goa",
      level: "Top rated",
      rating: 4.85,
      reviews: 64,
    },
    rating_given: 5,
  },
];

window.MM.NOTIFS = [
  { id: "n1", type: "match", title: "3 freelancers matched", body: "Diwali campaign hero video", time: "12m" },
  { id: "n2", type: "offer", title: "Arjun sent a counter offer", body: "Instagram reel pack — ₹20,500", time: "1h" },
  { id: "n3", type: "delivery", title: "Kavya shared a milestone", body: "Hero shots — 6 proofs", time: "2h" },
  { id: "n4", type: "wallet", title: "Top-up successful", body: "₹5,000 added to wallet", time: "yesterday" },
];

window.MM.TXNS = [
  { id: "t1", date: "Oct 14", type: "topup",   desc: "Razorpay top-up",                          amt:  5000, balance: 12450 },
  { id: "t2", date: "Oct 12", type: "escrow",  desc: "Escrow locked — Winter photoshoot",        amt: -45000, balance: 7450 },
  { id: "t3", date: "Oct 12", type: "topup",   desc: "Razorpay top-up",                          amt: 50000, balance: 52450 },
  { id: "t4", date: "Oct 09", type: "ai",      desc: "Mint AI — caption generation",             amt: -12, balance: 2450 },
  { id: "t5", date: "Oct 08", type: "release", desc: "Released to Rohan — Logo refresh",         amt: -22000, balance: 2462 },
  { id: "t6", date: "Oct 08", type: "addon",   desc: "Marketplace access — 30 days",             amt: -599, balance: 24462 },
  { id: "t7", date: "Oct 02", type: "topup",   desc: "Razorpay top-up",                          amt: 25000, balance: 25061 },
];

window.MM.ESCROW_BREAKDOWN = [
  { job: "Product photoshoot — winter collection", freelancer: "Kavya Iyer", amount: 45000, status: "in_progress" },
];

// Status presentations
window.MM.STATUS_META = {
  draft:        { label: "Draft",        tone: "neutral" },
  matching:     { label: "Matching",     tone: "violet"  },
  negotiating:  { label: "Negotiating",  tone: "amber"   },
  in_progress:  { label: "In progress",  tone: "mint"    },
  completed:    { label: "Completed",    tone: "sky"     },
  cancelled:    { label: "Cancelled",    tone: "rose"    },
};

window.MM.CATEGORIES = [
  "Videography", "Photography", "Social media", "Branding",
  "Copywriting", "Web design", "Illustration", "Animation", "UI/UX",
];
