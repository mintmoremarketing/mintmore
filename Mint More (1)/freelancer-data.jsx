// Freelancer-side sample data — Indian creatives, ₹ pricing, real-feeling

window.MM.FREELANCER = {
  id: "f_001",
  name: "Arjun Mehta",
  initials: "AM",
  email: "arjun@arjunmehta.in",
  role: "freelancer",
  tagline: "Reels &amp; brand films editor · Mumbai",
  bio: "Editor for D2C brands. 6 years in post-production, 200+ delivered reels, ex-Pocket Aces. I'm fast, I'm picky about pacing, and I love subtitles that don't fight the visuals.",
  city: "Mumbai",
  level: "Top rated",
  rating: 4.92,
  reviews: 142,
  response_time: "Under 1 hour",
  hourly_rate: 1800,
  marketplace_visible: true,
  active_slots: 3,
  max_slots: 5,
  languages: ["English", "Hindi", "Marathi"],
  tools: ["Premiere Pro", "After Effects", "DaVinci Resolve", "CapCut"],
  skills: ["Reels editing", "Brand films", "Color grading", "Subtitles", "Trending audio", "Motion graphics"],
};

window.MM.FREELANCER_WALLET = {
  available: 84200,
  pending: 22500,
  withdrawable: 84200,
};

window.MM.FREELANCER_EARNINGS_30D = [
  // last 30 days, daily ₹ — used by mini chart
  0, 0, 4500, 0, 0, 12000, 0, 6500, 0, 0,
  18500, 0, 0, 0, 22000, 0, 4500, 0, 0, 0,
  9500, 0, 14500, 0, 0, 0, 7500, 0, 22000, 4200,
];

window.MM.FREELANCER_JOBS = [
  {
    id: "fj_001",
    title: "Diwali campaign hero video for Tilak Weaves",
    client: { name: "Priya Sharma", initials: "PS", business: "Tilak Weaves" },
    category: "Videography",
    status: "matching", // new match
    budget_range: "₹30K — ₹40K",
    deadline: "Nov 02, 2026",
    received: "2 hours ago",
    description: "60-90 second hero film for handloom Diwali drop. Calm, emotional pacing — not loud. Footage shot in Varanasi.",
    required_skills: ["Cinematic video", "Storytelling", "Color grading"],
    new_match: true,
  },
  {
    id: "fj_002",
    title: "Instagram reel pack — 6 reels on saree styling",
    client: { name: "Priya Sharma", initials: "PS", business: "Tilak Weaves" },
    category: "Social media",
    status: "negotiating",
    budget_range: "₹15K — ₹20K",
    deadline: "Oct 28, 2026",
    received: "yesterday",
    description: "6 short reels (15-30s) on saree drape styles. Trending audio + captions + brand watermark.",
    required_skills: ["Reels editing", "Trending audio", "Captions"],
    rounds: [
      { who: "me",   price: 22000, days: 9, message: "I'd love to take this on. My standard for a 6-reel pack with trending audio + captions is ₹22k. Can deliver in 9 days." },
      { who: "them", price: 19000, days: 10, message: "Budget is tight on our end — can we land at ₹19k? Extra day is fine." },
    ],
    current_round: 3,
    max_rounds: 5,
  },
  {
    id: "fj_003",
    title: "Brand reel for D2C skincare launch — Kindred",
    client: { name: "Aditi Rao", initials: "AR", business: "Kindred" },
    category: "Social media",
    status: "in_progress",
    budget_range: "₹35K",
    deadline: "Oct 24, 2026",
    received: "1 week ago",
    description: "12 reels for D2C skincare launch — 4 founder POV, 4 product demo, 4 customer testimonial.",
    required_skills: ["Reels editing", "Storytelling", "Subtitles"],
    escrowed: 35000,
    progress: 50,
  },
  {
    id: "fj_004",
    title: "Café brand film for Bombay Roastery — Bandra outlet",
    client: { name: "Vikram Joshi", initials: "VJ", business: "Bombay Roastery" },
    category: "Videography",
    status: "completed",
    budget_range: "₹48K",
    deadline: "Sep 20, 2026",
    received: "1 month ago",
    description: "3-minute brand film for the Bandra flagship opening. Capture the bean-to-cup story.",
    rating_received: 5,
  },
];

// Direct inquiries from clients (Marketplace add-on)
window.MM.FREELANCER_INQUIRIES = [
  {
    id: "iq_001",
    client: { name: "Rhea Kapoor", initials: "RK", business: "Olio Skincare" },
    package: "Standard",
    message: "Hi Arjun — loved your Kindred work. We're launching a new SPF range and need 8 reels. Could you take this on in November?",
    budget: 28000,
    deadline_days: 14,
    received: "1 hour ago",
    status: "new",
  },
  {
    id: "iq_002",
    client: { name: "Karthik Subramaniam", initials: "KS", business: "Filter Coffee Co." },
    package: "Premium",
    message: "Brand film for our 5-year anniversary. Documentary style. Budget is flexible if the right person.",
    budget: 65000,
    deadline_days: 30,
    received: "yesterday",
    status: "new",
  },
];

// Marketplace packages — Basic / Standard / Premium
window.MM.FREELANCER_PACKAGES = [
  {
    tier: "Basic",
    name: "Single Reel",
    description: "1 polished reel — trending audio, subtitles, your colors.",
    price: 4500,
    delivery_days: 4,
    revisions: 2,
    inclusions: ["1 reel (15–30s)", "Trending audio matched to your brand", "Burned-in subtitles", "1 vertical + 1 square export"],
  },
  {
    tier: "Standard",
    name: "Reel Pack — 6",
    description: "6 reels in a coherent visual system. Ideal for monthly content drops.",
    price: 24000,
    delivery_days: 9,
    revisions: 3,
    inclusions: ["6 reels (15–45s)", "Consistent color grade + brand kit", "Hooks + CTAs scripted", "Hashtag &amp; caption pack", "Vertical + square exports"],
    popular: true,
  },
  {
    tier: "Premium",
    name: "Brand Film",
    description: "Cinematic 60–120s brand film. Concept → script → edit → grade.",
    price: 55000,
    delivery_days: 18,
    revisions: 4,
    inclusions: ["Pre-prod call &amp; shotlist", "60–120s film with original cut", "Cinematic color grading", "Sound design + license", "Square &amp; vertical recut", "Source files on delivery"],
  },
];

// Portfolio — placeholders, no inline SVG art
window.MM.FREELANCER_PORTFOLIO = [
  { id: "p1", title: "Kindred — founder reel series",  category: "Reels", duration: "6 weeks", price_range: "₹35K", tags: ["D2C", "Skincare", "Founder POV"], featured: true,  swatch: "linear-gradient(135deg, #1B2128, #4A535E)" },
  { id: "p2", title: "Bombay Roastery — Bandra brand film", category: "Brand films", duration: "3 weeks", price_range: "₹48K", tags: ["Documentary", "F&B"], featured: true, swatch: "linear-gradient(135deg, #C68A2E, #8A5A2B)" },
  { id: "p3", title: "Saree drape series — Aaranya",   category: "Reels", duration: "2 weeks", price_range: "₹18K", tags: ["Fashion", "Styling"], featured: false, swatch: "linear-gradient(135deg, #B4434E, #6B2530)" },
  { id: "p4", title: "Filter Coffee Co. — origin story", category: "Brand films", duration: "4 weeks", price_range: "₹52K", tags: ["F&B", "Documentary"], featured: false, swatch: "linear-gradient(135deg, oklch(0.62 0.13 165), oklch(0.42 0.09 165))" },
  { id: "p5", title: "Olio — SPF launch teaser",        category: "Reels", duration: "1 week",  price_range: "₹12K", tags: ["D2C", "Launch"], featured: false, swatch: "linear-gradient(135deg, #6D28D9, #2E1065)" },
  { id: "p6", title: "Anveshana — Diwali campaign",     category: "Reels", duration: "3 weeks", price_range: "₹32K", tags: ["Festive", "Fashion"], featured: false, swatch: "linear-gradient(135deg, #D97706, #92400E)" },
];

// Notifications — extended set for Phase 2 inbox
window.MM.NOTIFS_FULL = [
  { id: "n1", type: "match",    title: "3 freelancers matched",            body: "Diwali campaign hero video for Tilak Weaves", time: "12m",      ts: "Today, 11:48 AM", unread: true,  jobId: "j_001" },
  { id: "n2", type: "offer",    title: "Arjun sent a counter offer",       body: "Instagram reel pack — ₹20,500 · 9 days",     time: "1h",       ts: "Today, 10:42 AM", unread: true,  jobId: "j_002" },
  { id: "n3", type: "delivery", title: "Kavya shared a milestone",         body: "Hero shots — 6 proofs ready for review",      time: "2h",       ts: "Today, 9:15 AM",  unread: false, jobId: "j_003" },
  { id: "n4", type: "wallet",   title: "Top-up successful",                body: "₹5,000 added to your wallet · Razorpay",      time: "1d",       ts: "Yesterday",       unread: false },
  { id: "n5", type: "admin",    title: "Deal approved by admin",           body: "Logo refresh · ₹22,000 released to Rohan",    time: "3d",       ts: "Oct 14",          unread: false, jobId: "j_005" },
  { id: "n6", type: "ai",       title: "Mint AI generation complete",      body: "Diwali caption pack · Claude 3.5 Sonnet",     time: "4d",       ts: "Oct 13",          unread: false },
  { id: "n7", type: "match",    title: "1 more creative joined short-list", body: "Vikram Joshi · 88% fit",                     time: "5d",       ts: "Oct 12",          unread: false, jobId: "j_001" },
  { id: "n8", type: "system",   title: "Marketplace access expires soon",  body: "5 days remaining on your 30-day plan",        time: "1w",       ts: "Oct 08",          unread: false },
];
