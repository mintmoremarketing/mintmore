// Phase 5 — Browse freelancers (client-side marketplace), Social publisher, Mint AI

// =========================================================
// Browse Freelancers (Marketplace)
// =========================================================
function BrowseFreelancers({ onNav, isMobile, pushToast }) {
  const [cat, setCat] = React.useState("all");
  const [q, setQ] = React.useState("");
  const [sort, setSort] = React.useState("rating");
  const [budget, setBudget] = React.useState([3000, 50000]);
  const [view, setView] = React.useState("grid");
  const [selected, setSelected] = React.useState(null);

  const all = window.MM.MARKETPLACE_FREELANCERS;
  let list = all.filter(f => {
    if (cat !== "all" && f.category !== cat) return false;
    if (f.starts < budget[0] || f.starts > budget[1]) return false;
    if (q && !(f.name + f.tagline + f.city + f.skills.join(" ")).toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });
  list = list.slice().sort((a, b) => {
    if (sort === "rating") return b.rating - a.rating;
    if (sort === "price-low") return a.starts - b.starts;
    if (sort === "price-high") return b.starts - a.starts;
    if (sort === "response") return a.responseHrs - b.responseHrs;
    return 0;
  });

  const cats = window.MM.MARKETPLACE_CATEGORIES;

  return (
    <div className="stack-6">
      <div className="row between reveal" data-d="0" style={{ flexWrap: "wrap", gap: 12 }}>
        <div>
          <div className="h-eyebrow" style={{ marginBottom: 4 }}>Creative</div>
          <h1 className="h-display h-1" style={{ margin: 0 }}>Marketplace</h1>
          <p className="muted" style={{ marginTop: 6 }}>Browse {all.length} curated creatives. Direct hire from ₹3,500.</p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn ghost"><Icon name="sparkles" /> Use AI brief assistant</button>
          <button className="btn primary" onClick={() => onNav("post-job")}><Icon name="plus" /> Post a brief instead</button>
        </div>
      </div>

      {/* Category strip */}
      <div className="reveal" data-d="1" style={{
        display: "flex", gap: 6, overflowX: "auto", padding: "2px 2px 6px",
      }}>
        {cats.map(c => (
          <button key={c.key} onClick={() => setCat(c.key)} style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "8px 14px",
            background: cat === c.key ? "var(--ink-950)" : "white",
            color: cat === c.key ? "white" : "var(--ink-700)",
            border: "1px solid " + (cat === c.key ? "var(--ink-950)" : "var(--hairline)"),
            borderRadius: 999, fontFamily: "inherit", fontSize: 12.5, fontWeight: 500,
            cursor: "pointer", flexShrink: 0, transition: "all 0.12s ease",
          }}>
            <Icon name={c.icon} size={12} /> {c.label}
          </button>
        ))}
      </div>

      {/* Search + sort */}
      <div className="card reveal" data-d="2" style={{ padding: 14 }}>
        <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div className="input-with-prefix" style={{ flex: 1, minWidth: 220 }}>
            <span className="prefix"><Icon name="search" size={13} /></span>
            <input className="input" placeholder="Search by name, skill, city…" value={q} onChange={e => setQ(e.target.value)} style={{ paddingLeft: 32 }} />
          </div>
          <div className="row" style={{ gap: 8, fontSize: 12, color: "var(--ink-600)" }}>
            <span>Budget</span>
            <input type="range" className="slider" min="3000" max="80000" step="500" value={budget[1]} onChange={e => setBudget([budget[0], parseInt(e.target.value)])} style={{ width: 140 }} />
            <span className="mono" style={{ minWidth: 80, color: "var(--ink-900)", fontWeight: 500 }}>{rupee(budget[0])}–{rupee(budget[1])}</span>
          </div>
          <select className="select" value={sort} onChange={e => setSort(e.target.value)} style={{ width: 170 }}>
            <option value="rating">Top rated</option>
            <option value="price-low">Price: low to high</option>
            <option value="price-high">Price: high to low</option>
            <option value="response">Fastest response</option>
          </select>
          {!isMobile && (
            <div className="tabs" style={{ padding: 2 }}>
              <button className={`tab ${view === "grid" ? "active" : ""}`} onClick={() => setView("grid")}>
                <Icon name="layers" size={11} />
              </button>
              <button className={`tab ${view === "list" ? "active" : ""}`} onClick={() => setView("list")}>
                <Icon name="more" size={11} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="row between reveal" data-d="3" style={{ fontSize: 12.5, color: "var(--ink-600)" }}>
        <span><strong style={{ color: "var(--ink-900)" }}>{list.length}</strong> creatives</span>
        <span style={{ fontFamily: "var(--font-mono)" }}>{cat === "all" ? "All categories" : cat}</span>
      </div>

      {list.length === 0 ? (
        <div className="empty">
          <div className="empty-glyph"><Icon name="search" /></div>
          <h3>No creatives match these filters</h3>
          <p>Loosen the budget range or try a different category — we have 1,840 actively working on Mintmore right now.</p>
          <button className="btn ghost" onClick={() => { setCat("all"); setQ(""); setBudget([3000, 80000]); }}>
            <Icon name="refresh" size={12} /> Reset filters
          </button>
        </div>
      ) : view === "grid" ? (
        <div className="grid-3 reveal" data-d="4" style={{ gap: 14 }}>
          {list.map((f, i) => <FreelancerCard key={f.id} f={f} idx={i} onClick={() => setSelected(f)} />)}
        </div>
      ) : (
        <div className="card reveal" data-d="4" style={{ padding: 0 }}>
          {list.map((f, i) => <FreelancerRow key={f.id} f={f} top={i === 0} onClick={() => setSelected(f)} />)}
        </div>
      )}

      {selected && <FreelancerPreview f={selected} onClose={() => setSelected(null)} pushToast={pushToast} onNav={onNav} />}
    </div>
  );
}

function FreelancerCard({ f, idx, onClick }) {
  return (
    <button onClick={onClick} className="reveal" data-d={5 + (idx % 4)} style={{
      background: "var(--paper)", border: "1px solid var(--hairline)",
      borderRadius: "var(--radius-md)", padding: 0, overflow: "hidden",
      cursor: "pointer", textAlign: "left", fontFamily: "inherit",
      transition: "border-color 0.12s ease, transform 0.12s ease",
    }} onMouseOver={e => { e.currentTarget.style.borderColor = "var(--hairline-strong)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
       onMouseOut={e => { e.currentTarget.style.borderColor = "var(--hairline)"; e.currentTarget.style.transform = "translateY(0)"; }}>
      <div style={{ height: 70, background: f.swatch, position: "relative" }}>
        {f.online && (
          <span className="badge" style={{ position: "absolute", top: 10, right: 10, background: "rgba(255,255,255,0.95)", color: "var(--mint-800)", border: 0, fontSize: 10 }}>
            <span className="bdot" style={{ background: "var(--mint-600)" }}></span> Online
          </span>
        )}
      </div>
      <div style={{ padding: "16px 16px 14px", position: "relative" }}>
        <div style={{ position: "absolute", top: -22, left: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", border: "3px solid var(--paper)", background: "linear-gradient(135deg, var(--mint-300), var(--mint-700))", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 15 }}>
            {f.initials}
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          <div className="row" style={{ gap: 6, marginBottom: 2 }}>
            <span style={{ fontSize: 14.5, fontWeight: 600, color: "var(--ink-950)" }}>{f.name}</span>
            <span className="badge dark" style={{ fontSize: 9.5 }}>{f.level}</span>
          </div>
          <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>{f.tagline} · {f.city}</div>
          <div className="row" style={{ gap: 8, fontSize: 12, color: "var(--ink-700)", marginBottom: 12 }}>
            <span style={{ color: "var(--amber)" }}><Icon name="star" size={11} strokeWidth={2.4} /></span>
            <span className="mono" style={{ fontWeight: 500 }}>{f.rating}</span>
            <span className="muted">({f.reviews})</span>
            <span className="muted">·</span>
            <span style={{ fontSize: 11.5 }}>Replies in ~{f.responseHrs}h</span>
          </div>
          <div className="row wrap" style={{ gap: 4, marginBottom: 14 }}>
            {f.skills.slice(0, 3).map(s => <span key={s} className="badge neutral" style={{ fontSize: 10 }}>{s}</span>)}
          </div>
          <div className="row between" style={{ borderTop: "1px solid var(--hairline)", paddingTop: 10 }}>
            <div>
              <div className="muted" style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.06em" }}>Starts at</div>
              <div className="mono" style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-950)", marginTop: 2 }}>{rupee(f.starts)}</div>
            </div>
            <span className="badge neutral" style={{ background: "var(--ink-950)", color: "white", border: 0 }}>
              View <Icon name="arrowRight" size={10} />
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

function FreelancerRow({ f, top, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: "grid", gridTemplateColumns: "auto 1.5fr 1fr 1fr 1fr 100px",
      gap: 14, padding: "16px 18px", alignItems: "center",
      background: "transparent", border: 0, width: "100%", textAlign: "left",
      borderTop: top ? "0" : "1px solid var(--hairline)", cursor: "pointer", fontFamily: "inherit",
      transition: "background 0.1s ease",
    }} onMouseOver={e => e.currentTarget.style.background = "var(--paper-tint)"}
       onMouseOut={e => e.currentTarget.style.background = "transparent"}>
      <Avatar initials={f.initials} size="lg" />
      <div>
        <div className="row" style={{ gap: 6, marginBottom: 2 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-950)" }}>{f.name}</span>
          {f.online && <span className="bdot" style={{ background: "var(--mint-500)", boxShadow: "0 0 0 2px var(--mint-100)" }}></span>}
        </div>
        <div className="muted" style={{ fontSize: 12 }}>{f.tagline} · {f.city}</div>
      </div>
      <div className="row" style={{ gap: 5, fontSize: 12.5 }}>
        <span style={{ color: "var(--amber)" }}><Icon name="star" size={11} strokeWidth={2.4} /></span>
        <span className="mono" style={{ fontWeight: 500 }}>{f.rating}</span>
        <span className="muted">({f.reviews})</span>
      </div>
      <div className="row wrap" style={{ gap: 4 }}>
        {f.skills.slice(0, 2).map(s => <span key={s} className="badge neutral" style={{ fontSize: 10 }}>{s}</span>)}
      </div>
      <div className="mono" style={{ fontSize: 13, fontWeight: 500 }}>{rupee(f.starts)}</div>
      <div style={{ textAlign: "right" }}>
        <span className="btn ghost sm">View</span>
      </div>
    </button>
  );
}

function FreelancerPreview({ f, onClose, pushToast, onNav }) {
  return (
    <Modal title={f.name} subtitle={`${f.tagline} · ${f.city}`} onClose={onClose} maxWidth={560}
      footer={
        <>
          <button className="btn ghost" onClick={() => { pushToast({ title: "Inquiry sent", body: `Direct message to ${f.name}` }); onClose(); }}>
            <Icon name="chat" /> Message
          </button>
          <button className="btn primary" onClick={() => { pushToast({ title: "Adding to brief", body: "We'll prefill the post-job form" }); onClose(); onNav("post-job"); }}>
            <Icon name="briefcase" /> Hire on a brief
          </button>
        </>
      }>
      <div style={{ height: 110, background: f.swatch, borderRadius: 12, marginBottom: 12, position: "relative" }}>
        <div style={{ position: "absolute", top: 10, right: 10 }}>
          <span className="badge dark">{f.level}</span>
        </div>
      </div>
      <div className="row between" style={{ marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <div className="row" style={{ gap: 16, fontSize: 12 }}>
          <span><Icon name="star" size={11} className="muted" /> <span className="mono" style={{ fontWeight: 500 }}>{f.rating}</span> ({f.reviews})</span>
          <span><Icon name="clock" size={11} className="muted" /> ~{f.responseHrs}h reply</span>
          {f.online && <span className="badge mint"><span className="bdot"></span>Online</span>}
        </div>
        <div className="mono" style={{ fontSize: 15, fontWeight: 600 }}>
          {rupee(f.starts)}<span className="muted" style={{ fontSize: 11, marginLeft: 4 }}>starts</span>
        </div>
      </div>
      <div className="card-tint" style={{ padding: 12, marginBottom: 12 }}>
        <div className="h-eyebrow" style={{ marginBottom: 6 }}>Skills</div>
        <div className="row wrap" style={{ gap: 4 }}>
          {f.skills.map(s => <span key={s} className="badge neutral">{s}</span>)}
        </div>
        <div className="h-eyebrow" style={{ marginBottom: 6, marginTop: 12 }}>Tools</div>
        <div className="row wrap" style={{ gap: 4 }}>
          {f.tools.map(t => <span key={t} className="badge sky">{t}</span>)}
        </div>
      </div>
      <div style={{ fontSize: 12.5, color: "var(--ink-600)", lineHeight: 1.55 }}>
        Click <strong>View</strong> in a card to see the full profile, packages, and portfolio. Posting a brief shares your job with {f.name} and lets them counter-offer privately.
      </div>
    </Modal>
  );
}

// =========================================================
// Social Media Publisher
// =========================================================
function SocialPublisher({ isMobile, pushToast }) {
  const [tab, setTab] = React.useState("compose");
  const accounts = window.MM.SOCIAL_ACCOUNTS;
  const scheduled = window.MM.SOCIAL_SCHEDULED;
  const published = window.MM.SOCIAL_PUBLISHED;

  return (
    <div className="stack-6">
      <div className="row between reveal" data-d="0" style={{ flexWrap: "wrap", gap: 12 }}>
        <div>
          <div className="h-eyebrow" style={{ marginBottom: 4 }}>Creative</div>
          <h1 className="h-display h-1" style={{ margin: 0 }}>Social</h1>
          <p className="muted" style={{ marginTop: 6 }}>Publish, schedule and track across Instagram, Facebook, YouTube and WhatsApp Business.</p>
        </div>
      </div>

      {/* Connected accounts */}
      <div className="grid-4 reveal" data-d="1" style={{ gap: 10 }}>
        {accounts.map(a => <SocialAccountChip key={a.id} a={a} />)}
      </div>

      <Tabs value={tab} onChange={setTab} items={[
        { value: "compose", label: "Compose" },
        { value: "scheduled", label: "Scheduled", count: scheduled.filter(p => p.status === "scheduled").length },
        { value: "drafts", label: "Drafts", count: scheduled.filter(p => p.status === "draft").length },
        { value: "published", label: "Published" },
      ]} />

      {tab === "compose" && <SocialCompose pushToast={pushToast} isMobile={isMobile} />}
      {tab === "scheduled" && <SocialList items={scheduled.filter(p => p.status === "scheduled")} isMobile={isMobile} />}
      {tab === "drafts" && <SocialList items={scheduled.filter(p => p.status === "draft")} isMobile={isMobile} />}
      {tab === "published" && <SocialPublished items={published} isMobile={isMobile} />}
    </div>
  );
}

function SocialAccountChip({ a }) {
  const colors = {
    instagram: { bg: "linear-gradient(135deg, #C13584, #E1306C, #F77737)", icon: "instagram" },
    facebook:  { bg: "#1877F2", icon: "facebook" },
    youtube:   { bg: "#FF0000", icon: "youtube" },
    whatsapp:  { bg: "#25D366", icon: "whatsapp" },
  }[a.platform];
  return (
    <div className="card" style={{ padding: 12, opacity: a.connected ? 1 : 0.65 }}>
      <div className="row" style={{ gap: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: colors.bg, color: "white",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Icon name={colors.icon} size={16} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-950)" }}>{a.handle}</div>
          <div className="muted" style={{ fontSize: 11.5 }}>{a.connected ? `${a.followers} followers` : "Not connected"}</div>
        </div>
        {a.connected ? (
          <span className="bdot" style={{ background: "var(--mint-500)", boxShadow: "0 0 0 2px var(--mint-100)" }}></span>
        ) : (
          <button className="btn link sm" style={{ padding: "2px 6px", fontSize: 11 }}>Connect</button>
        )}
      </div>
    </div>
  );
}

function SocialCompose({ pushToast, isMobile }) {
  const [caption, setCaption] = React.useState("");
  const [platforms, setPlatforms] = React.useState(["instagram", "facebook"]);
  const [when, setWhen] = React.useState("now");
  const [date, setDate] = React.useState("2026-10-22");
  const [time, setTime] = React.useState("18:00");
  const [aiOpen, setAiOpen] = React.useState(false);

  function toggle(p) {
    setPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  }

  function publish() {
    if (when === "now") {
      pushToast({ title: "Posted live", body: `${platforms.length} platform${platforms.length > 1 ? "s" : ""} · receipts arrive in 30s` });
    } else if (when === "schedule") {
      pushToast({ title: "Scheduled", body: `${date} at ${time} · ${platforms.length} platforms` });
    } else {
      pushToast({ title: "Saved to drafts", body: "Pick it up from Drafts later" });
    }
    setCaption("");
  }

  return (
    <div className="reveal" data-d="2" style={{
      display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 320px", gap: 16,
    }}>
      <div className="stack" style={{ gap: 14 }}>
        <div className="card">
          <h3 className="h-display h-3" style={{ margin: "0 0 14px" }}>What are we posting?</h3>

          {/* Platform picker */}
          <div className="h-eyebrow" style={{ marginBottom: 8 }}>Post to</div>
          <div className="row" style={{ gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
            {["instagram", "facebook", "youtube", "whatsapp"].map(p => {
              const on = platforms.includes(p);
              return (
                <button key={p} onClick={() => toggle(p)} className="btn ghost" style={{
                  border: on ? "1.5px solid var(--ink-950)" : "1px solid var(--hairline)",
                  background: on ? "var(--paper-tint)" : "white",
                  color: on ? "var(--ink-950)" : "var(--ink-600)",
                  padding: "6px 12px", fontSize: 12,
                }}>
                  <Icon name={p} size={13} />
                  {p[0].toUpperCase() + p.slice(1)}
                </button>
              );
            })}
          </div>

          {/* Media slot */}
          <div style={{
            border: "1.5px dashed var(--hairline-strong)", borderRadius: "var(--radius-md)",
            padding: 22, textAlign: "center", background: "var(--paper-tint)", marginBottom: 14,
          }}>
            <Icon name="upload" size={20} className="muted" />
            <div style={{ fontSize: 13, color: "var(--ink-700)", marginTop: 8 }}>
              Drop video or images, or <span style={{ color: "var(--ink-950)", textDecoration: "underline", cursor: "pointer" }}>browse</span>
            </div>
            <div className="field-hint">Up to 10 files · MP4, MOV, PNG, JPG · 200MB each</div>
          </div>

          {/* Caption */}
          <div className="field">
            <div className="row between" style={{ marginBottom: 6 }}>
              <label className="field-label">Caption</label>
              <button className="btn link sm" onClick={() => setAiOpen(!aiOpen)} style={{ padding: "2px 6px", fontSize: 11 }}>
                <Icon name="sparkles" size={11} /> Mint AI
              </button>
            </div>
            <textarea className="textarea" rows={5} placeholder="Hook in the first 4 words…"
              value={caption} onChange={e => setCaption(e.target.value)} />
            <div className="row between" style={{ marginTop: 6 }}>
              <span className="field-hint">{caption.length}/2200 · {(caption.match(/#\w+/g) || []).length} hashtags</span>
              <button className="btn link sm" style={{ padding: "2px 6px", fontSize: 11 }}>
                <Icon name="copy" size={11} /> Templates
              </button>
            </div>
          </div>

          {aiOpen && (
            <div style={{
              marginTop: 12,
              background: "var(--ink-950)", color: "white",
              borderRadius: 10, padding: 14,
            }}>
              <div className="row between" style={{ marginBottom: 10 }}>
                <span style={{ fontWeight: 500, fontSize: 13 }}><Icon name="sparkles" size={12} /> Mint AI · 6 caption variants</span>
                <button className="icon-btn" onClick={() => setAiOpen(false)} style={{ background: "rgba(255,255,255,0.1)", border: 0, color: "white" }}>
                  <Icon name="x" size={11} />
                </button>
              </div>
              <div className="stack" style={{ gap: 6 }}>
                {[
                  "Diwali drops in 9 days. Set a reminder so we don't sell out by Tuesday. ✨",
                  "Six weeks on a single loom. Worth every minute.",
                  "Tag the friend who deserves a Banarasi this Diwali.",
                ].map((s, i) => (
                  <button key={i} onClick={() => { setCaption(s); setAiOpen(false); }}
                    style={{ textAlign: "left", padding: 10, borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "white", fontFamily: "inherit", fontSize: 12.5, cursor: "pointer" }}>
                    {s}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.5)", marginTop: 8, fontFamily: "var(--font-mono)" }}>
                Costs ₹4 from your wallet · Mintmore Pro
              </div>
            </div>
          )}
        </div>

        {/* Schedule */}
        <div className="card">
          <h3 className="h-display h-3" style={{ margin: "0 0 14px" }}>When?</h3>
          <div className="row" style={{ gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
            {["now", "schedule", "draft"].map(opt => (
              <button key={opt} onClick={() => setWhen(opt)} className="btn ghost" style={{
                border: when === opt ? "1.5px solid var(--ink-950)" : "1px solid var(--hairline)",
                background: when === opt ? "var(--paper-tint)" : "white",
                color: when === opt ? "var(--ink-950)" : "var(--ink-600)",
                padding: "6px 12px", fontSize: 12,
              }}>
                {opt === "now" ? "Post now" : opt === "schedule" ? "Schedule" : "Save as draft"}
              </button>
            ))}
          </div>
          {when === "schedule" && (
            <div className="grid-2" style={{ gap: 10 }}>
              <div className="field">
                <label className="field-label">Date</label>
                <input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} />
              </div>
              <div className="field">
                <label className="field-label">Time (IST)</label>
                <input className="input" type="time" value={time} onChange={e => setTime(e.target.value)} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Live preview */}
      <div className="reveal" data-d="3" style={{ position: isMobile ? "static" : "sticky", top: 80 }}>
        <div className="h-eyebrow" style={{ marginBottom: 10 }}>Preview · Instagram</div>
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="row" style={{ gap: 10, padding: 12, borderBottom: "1px solid var(--hairline)" }}>
            <div className="avatar sm" style={{ background: "linear-gradient(135deg, #C13584, #F77737)" }}>TW</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600 }}>tilakweaves</div>
              <div className="muted" style={{ fontSize: 11 }}>Varanasi · Sponsored</div>
            </div>
            <Icon name="more" size={14} />
          </div>
          <div style={{
            aspectRatio: "4/5",
            background: "linear-gradient(135deg, var(--mint-200), var(--mint-700))",
            position: "relative",
          }}>
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.5)", fontFamily: "var(--font-mono)", fontSize: 11 }}>
              [video / image]
            </div>
          </div>
          <div style={{ padding: 12 }}>
            <div className="row" style={{ gap: 14, marginBottom: 8, color: "var(--ink-800)" }}>
              <Icon name="star" size={16} />
              <Icon name="chat" size={16} />
              <Icon name="send" size={16} />
            </div>
            <div style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--ink-900)" }}>
              <strong>tilakweaves</strong> {caption || "Your caption will preview here…"}
            </div>
          </div>
        </div>
        <div className="row" style={{ gap: 8, marginTop: 14 }}>
          <button className="btn ghost block">Cancel</button>
          <button className="btn primary block" onClick={publish}>
            <Icon name="send" /> {when === "now" ? "Post now" : when === "schedule" ? "Schedule" : "Save draft"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SocialList({ items, isMobile }) {
  if (items.length === 0) {
    return (
      <div className="empty">
        <div className="empty-glyph"><Icon name="calendar" /></div>
        <h3>Nothing here yet</h3>
        <p>Compose a post above to fill this queue.</p>
      </div>
    );
  }
  return (
    <div className="stack reveal" data-d="2" style={{ gap: 10 }}>
      {items.map((p, i) => <ScheduledPostRow key={p.id} p={p} idx={i} />)}
    </div>
  );
}

function ScheduledPostRow({ p, idx }) {
  return (
    <div className="card reveal" data-d={idx % 5} style={{ padding: 14 }}>
      <div className="row" style={{ gap: 14, alignItems: "flex-start" }}>
        <div style={{
          width: 64, height: 64, borderRadius: 10,
          background: "linear-gradient(135deg, var(--mint-200), var(--mint-500))",
          flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
          color: "rgba(255,255,255,0.7)",
        }}>
          <Icon name={p.media} size={20} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="row between" style={{ marginBottom: 6 }}>
            <span style={{ fontSize: 13.5, fontWeight: 500, color: "var(--ink-950)", flex: 1, minWidth: 0 }}>{p.caption}</span>
            <span className={`badge ${p.status === "scheduled" ? "mint" : "neutral"}`}>
              <span className="bdot"></span>{p.status}
            </span>
          </div>
          <div className="row" style={{ gap: 10, fontSize: 12, color: "var(--ink-500)" }}>
            <span><Icon name="clock" size={11} /> {p.when}</span>
            <span>·</span>
            <div className="row" style={{ gap: 4 }}>
              {p.platforms.map(pl => <PlatformDot key={pl} platform={pl} />)}
            </div>
          </div>
        </div>
        <div className="row" style={{ gap: 4 }}>
          <button className="icon-btn"><Icon name="edit" size={12} /></button>
          <button className="icon-btn"><Icon name="more" size={12} /></button>
        </div>
      </div>
    </div>
  );
}

function PlatformDot({ platform }) {
  const colors = {
    instagram: "#E1306C", facebook: "#1877F2", youtube: "#FF0000", whatsapp: "#25D366",
  };
  return (
    <span style={{
      width: 16, height: 16, borderRadius: 4,
      background: colors[platform] || "var(--ink-500)",
      color: "white",
      display: "inline-flex", alignItems: "center", justifyContent: "center",
    }}>
      <Icon name={platform} size={9} strokeWidth={2.2} />
    </span>
  );
}

function SocialPublished({ items, isMobile }) {
  return (
    <div className="stack reveal" data-d="2" style={{ gap: 10 }}>
      {items.map((p, i) => (
        <div key={p.id} className="card reveal" data-d={i % 5} style={{ padding: 14 }}>
          <div className="row" style={{ gap: 14 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 10,
              background: "linear-gradient(135deg, var(--ink-700), var(--ink-900))",
              flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
              color: "rgba(255,255,255,0.5)",
            }}>
              <Icon name="image" size={18} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--ink-950)", marginBottom: 4 }}>{p.caption}</div>
              <div className="row" style={{ gap: 10, fontSize: 12, color: "var(--ink-500)" }}>
                <span>{p.when}</span>
                <div className="row" style={{ gap: 4 }}>
                  {p.platforms.map(pl => <PlatformDot key={pl} platform={pl} />)}
                </div>
              </div>
            </div>
            <div className="row" style={{ gap: 18 }}>
              <Metric label="Reach" v={p.reach} />
              <Metric label="Likes" v={p.likes.toLocaleString("en-IN")} />
              <Metric label="Comments" v={p.comments.toLocaleString("en-IN")} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Metric({ label, v }) {
  return (
    <div style={{ textAlign: "right" }}>
      <div className="muted" style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
      <div className="mono" style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-900)", marginTop: 2 }}>{v}</div>
    </div>
  );
}

// =========================================================
// Mint AI
// =========================================================
function MintAI({ isMobile, pushToast }) {
  const [messages, setMessages] = React.useState([
    { who: "ai", text: "Hi Priya — I'm Mint AI. Tell me what we're making today: a caption, a script, a brief, an image, a translation? Or just describe what's in your head." }
  ]);
  const [input, setInput] = React.useState("");
  const [typing, setTyping] = React.useState(false);
  const [activeCap, setActiveCap] = React.useState(null);

  const caps = window.MM.AI_CAPABILITIES;
  const suggestions = window.MM.AI_SUGGESTIONS;
  const history = window.MM.AI_HISTORY;

  function send(text) {
    const v = (text || input).trim();
    if (!v) return;
    setMessages(m => [...m, { who: "me", text: v }]);
    setInput("");
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setMessages(m => [...m, {
        who: "ai",
        text: aiReply(v),
        outputs: aiOutputs(v),
      }]);
    }, 1100);
  }

  function pickCap(c) {
    setActiveCap(c);
    send(c.desc);
  }

  return (
    <div className="stack-6">
      <div className="row between reveal" data-d="0" style={{ flexWrap: "wrap", gap: 12 }}>
        <div>
          <div className="h-eyebrow" style={{ marginBottom: 4 }}>Creative</div>
          <h1 className="h-display h-1" style={{ margin: 0 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <span style={{
                width: 28, height: 28, borderRadius: 8,
                background: "linear-gradient(135deg, var(--mint-400), var(--mint-700))",
                color: "white", display: "inline-flex", alignItems: "center", justifyContent: "center",
              }}>
                <Icon name="sparkles" size={14} strokeWidth={2.2} />
              </span>
              Mint AI
            </span>
          </h1>
          <p className="muted" style={{ marginTop: 6 }}>Captions, scripts, images, video, briefs — in your brand voice. Costs deducted from wallet.</p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <span className="badge mint"><span className="bdot"></span> {rupee(window.MM.WALLET.available)} wallet</span>
        </div>
      </div>

      {/* Capability tiles */}
      <div className={isMobile ? "grid-4" : "grid-3"} style={{ gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3, 1fr)", gap: 10 }}>
        {caps.map((c, i) => (
          <button key={c.id} onClick={() => pickCap(c)} className="reveal" data-d={1 + (i % 6)} style={{
            background: activeCap?.id === c.id ? "var(--ink-950)" : "var(--paper)",
            color: activeCap?.id === c.id ? "white" : "var(--ink-900)",
            border: "1px solid " + (activeCap?.id === c.id ? "var(--ink-950)" : "var(--hairline)"),
            borderRadius: 12, padding: 14, textAlign: "left", cursor: "pointer", fontFamily: "inherit",
            transition: "all 0.12s ease",
          }}>
            <div className="row between" style={{ marginBottom: 10 }}>
              <div style={{
                width: 30, height: 30, borderRadius: 8,
                background: activeCap?.id === c.id ? "rgba(255,255,255,0.1)" : "var(--paper-tint)",
                color: activeCap?.id === c.id ? "white" : "var(--ink-700)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Icon name={c.icon} size={14} />
              </div>
              <span className="mono" style={{ fontSize: 10.5, color: activeCap?.id === c.id ? "rgba(255,255,255,0.7)" : "var(--ink-500)" }}>
                {c.cost === 0 ? "Free" : `₹${c.cost}`}
              </span>
            </div>
            <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 4 }}>{c.name}</div>
            <div style={{ fontSize: 11.5, color: activeCap?.id === c.id ? "rgba(255,255,255,0.7)" : "var(--ink-500)", lineHeight: 1.5 }}>{c.desc}</div>
          </button>
        ))}
      </div>

      {/* Chat surface */}
      <div className="reveal" data-d="3" style={{
        display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 280px", gap: 16,
      }}>
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="row between" style={{ padding: "12px 16px", borderBottom: "1px solid var(--hairline)" }}>
            <div className="row" style={{ gap: 8 }}>
              <div style={{
                width: 22, height: 22, borderRadius: 6,
                background: "linear-gradient(135deg, var(--mint-400), var(--mint-700))",
                display: "flex", alignItems: "center", justifyContent: "center", color: "white",
              }}><Icon name="sparkles" size={11} strokeWidth={2.2} /></div>
              <span style={{ fontSize: 13, fontWeight: 500 }}>Mint AI · session</span>
            </div>
            <span className="mono" style={{ fontSize: 11, color: "var(--ink-500)" }}>Claude 3.5 Sonnet</span>
          </div>

          <div style={{ padding: 16, minHeight: 320, maxHeight: 480, overflowY: "auto", background: "var(--paper-tint)" }}>
            {messages.map((m, i) => (
              <div key={i} className={`bubble-row ${m.who === "me" ? "me" : "them"}`} style={{ marginBottom: 8 }}>
                <div className="bubble" style={{ maxWidth: "80%" }}>
                  {m.who === "ai" && <div className="who">Mint AI</div>}
                  <div>{m.text}</div>
                  {m.outputs && (
                    <div className="stack" style={{ gap: 6, marginTop: 10 }}>
                      {m.outputs.map((o, j) => (
                        <div key={j} style={{
                          background: "var(--paper-tint)",
                          border: "1px solid var(--hairline)",
                          borderRadius: 8, padding: 10,
                          fontSize: 12.5, color: "var(--ink-900)", lineHeight: 1.55,
                        }}>
                          {o}
                          <div className="row" style={{ gap: 6, marginTop: 8 }}>
                            <button className="btn link sm" style={{ padding: "2px 6px", fontSize: 11 }}><Icon name="copy" size={10} /> Copy</button>
                            <button className="btn link sm" style={{ padding: "2px 6px", fontSize: 11 }}><Icon name="refresh" size={10} /> Regenerate</button>
                            <button className="btn link sm" style={{ padding: "2px 6px", fontSize: 11 }}><Icon name="layers" size={10} /> Use in social</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {typing && (
              <div className="bubble-row them">
                <div className="bubble">
                  <div className="who">Mint AI</div>
                  <div className="typing-dots"><span></span><span></span><span></span></div>
                </div>
              </div>
            )}
          </div>

          {messages.length <= 1 && (
            <div style={{ padding: "8px 16px 0", borderTop: "1px dashed var(--hairline)", background: "var(--paper-tint)" }}>
              <div className="h-eyebrow" style={{ marginBottom: 8 }}>Try a prompt</div>
              <div className="row wrap" style={{ gap: 6, paddingBottom: 8 }}>
                {suggestions.slice(0, 4).map(s => (
                  <button key={s} onClick={() => send(s)} style={{
                    background: "white", border: "1px solid var(--hairline)",
                    borderRadius: 999, padding: "5px 10px", fontSize: 11.5,
                    color: "var(--ink-700)", fontFamily: "inherit", cursor: "pointer",
                  }}>{s.slice(0, 56)}{s.length > 56 ? "…" : ""}</button>
                ))}
              </div>
            </div>
          )}

          <div style={{ padding: 12, borderTop: "1px solid var(--hairline)", background: "var(--paper)" }}>
            <div className="row" style={{ gap: 8 }}>
              <input className="input" placeholder="Ask Mint AI to make something…" value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && send()} />
              <button className="btn primary" onClick={() => send()} disabled={!input.trim()}>
                <Icon name="send" size={12} /> Send
              </button>
            </div>
            <div className="row between" style={{ marginTop: 6 }}>
              <span style={{ fontSize: 11, color: "var(--ink-500)" }}>
                <Icon name="lock" size={10} /> Brand voice: <strong style={{ color: "var(--ink-800)" }}>Tilak Weaves — calm warm</strong>
              </span>
              <span style={{ fontSize: 11, color: "var(--ink-500)", fontFamily: "var(--font-mono)" }}>
                Press <kbd style={{ background: "var(--paper-tint)", border: "1px solid var(--hairline)", padding: "1px 5px", borderRadius: 4 }}>↵</kbd>
              </span>
            </div>
          </div>
        </div>

        {/* History */}
        <div className="reveal" data-d="4" style={{ position: isMobile ? "static" : "sticky", top: 80 }}>
          <div className="h-eyebrow" style={{ marginBottom: 10 }}>Recent</div>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            {history.map((h, i) => (
              <div key={h.id} style={{
                display: "flex", gap: 10, padding: "12px 14px",
                borderTop: i === 0 ? "0" : "1px solid var(--hairline)",
                cursor: "pointer",
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: "var(--paper-tint)", color: "var(--ink-700)",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <Icon name={h.type === "copy" ? "type" : h.type === "image" ? "image" : h.type === "video" ? "video" : "sparkles"} size={13} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--ink-950)", lineHeight: 1.35 }}>{h.title}</div>
                  <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{h.output} · {h.time}</div>
                </div>
                <div className="mono" style={{ fontSize: 11, color: "var(--ink-500)", alignSelf: "center" }}>
                  {h.cost === 0 ? "Free" : `₹${h.cost}`}
                </div>
              </div>
            ))}
          </div>
          <div className="card-tint" style={{ padding: 12, marginTop: 14 }}>
            <div className="row" style={{ gap: 10 }}>
              <Icon name="zap" size={16} style={{ color: "var(--mint-700)", flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--ink-900)", marginBottom: 4 }}>Tip · Save your brand voice</div>
                <div style={{ fontSize: 11.5, color: "var(--ink-600)", lineHeight: 1.55 }}>
                  Upload 3 past posts and we'll learn your tone. Future outputs will match it without prompting.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function aiReply(prompt) {
  const p = prompt.toLowerCase();
  if (p.includes("caption")) return "Three caption variants below, calibrated to Tilak Weaves' calm-warm brand voice. Each ends with a soft CTA.";
  if (p.includes("brief")) return "Here's a brief draft. It includes scope, deliverables, suggested timeline and a price band. You can post it to matched freelancers in one click.";
  if (p.includes("image") || p.includes("flatlay") || p.includes("photo")) return "Generating 3 image variations · 1024×1024 · paper texture, warm side-light. (Preview placeholder shown below.)";
  if (p.includes("translate")) return "Translated. Check the Hindi & Marathi variants — I've preserved the rhythm and replaced English idioms with native equivalents.";
  if (p.includes("hook")) return "Three hooks. The first stops the scroll in 1.2s, the second leans on curiosity, the third lands on emotion.";
  return "Working on it — here's a first pass. Tell me what to push further and I'll iterate.";
}

function aiOutputs(prompt) {
  const p = prompt.toLowerCase();
  if (p.includes("caption")) return [
    "Six weeks on a single loom. Worth every minute. → drop ships Oct 24.",
    "Tag the friend who deserves a Banarasi this Diwali. ✨",
    "Diwali drops in 9 days. Set a reminder so we don't sell out by Tuesday.",
  ];
  if (p.includes("brief")) return [
    "Brief — Diwali campaign hero video for Tilak Weaves\n· 60–90s film · calm emotional pacing\n· Varanasi shoot, real artisans, finished pieces on real customers\n· Delivery: 14 days · Budget: ₹35K–₹40K\n· Need: cinematic video, color grading, storytelling",
  ];
  if (p.includes("image") || p.includes("flatlay")) return [
    "[image placeholder] — flat-lay · 3 sarees · paper texture · warm 4500K side-light · gold thread accents",
  ];
  if (p.includes("translate")) return [
    "हिंदी: छह हफ्ते एक करघे पर। हर मिनट के लायक।\nमराठी: सहा आठवडे एका मागावर. प्रत्येक क्षणाला योग्य.\nதமிழ்: ஆறு வாரங்கள் ஒரே தறியில். ஒவ்வொரு நிமிடமும் மதிப்புக்குரியது.",
  ];
  return ["First draft ready. Click regenerate for a different angle, or tell me what to change."];
}

Object.assign(window, {
  BrowseFreelancers, SocialPublisher, MintAI,
});
