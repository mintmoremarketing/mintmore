// Marketplace profile editor + Packages editor + Portfolio manager + Notifications inbox

// ===== Marketplace profile (edit with preview) =====
function MarketplaceProfile({ onNav, isMobile, pushToast }) {
  const f = window.MM.FREELANCER;
  const [tagline, setTagline] = React.useState("Reels & brand films editor · Mumbai");
  const [bio, setBio] = React.useState(f.bio.replace(/<[^>]+>/g, ""));
  const [hourly, setHourly] = React.useState(f.hourly_rate);
  const [response, setResponse] = React.useState(f.response_time);
  const [visible, setVisible] = React.useState(f.marketplace_visible);
  const [skills, setSkills] = React.useState(f.skills);
  const [tools, setTools] = React.useState(f.tools);
  const [languages, setLanguages] = React.useState(f.languages);

  function saveAll() {
    pushToast({ title: "Profile updated", body: "Live in the marketplace within 30 seconds." });
  }

  return (
    <div className="stack-6">
      <div className="row between reveal" data-d="0">
        <div>
          <div className="h-eyebrow" style={{ marginBottom: 4 }}>Marketplace</div>
          <h1 className="h-display h-1" style={{ margin: 0 }}>Profile</h1>
          <p className="muted" style={{ marginTop: 6 }}>How clients see you in the marketplace. Updates are live in seconds.</p>
        </div>
        <button className="btn primary" onClick={saveAll}><Icon name="check" /> Save changes</button>
      </div>

      <div className={isMobile ? "stack" : ""} style={{ display: isMobile ? "flex" : "grid", gridTemplateColumns: isMobile ? undefined : "1fr 380px", gap: 18 }}>
        {/* Editor */}
        <div className="stack" style={{ gap: 18 }}>
          <div className="card reveal" data-d="1">
            <div className="row between" style={{ marginBottom: 14 }}>
              <h3 className="h-display h-3" style={{ margin: 0 }}>Visibility</h3>
              <div className="row" style={{ gap: 8 }}>
                <span style={{ fontSize: 12, color: visible ? "var(--mint-700)" : "var(--ink-500)" }}>
                  {visible ? "Live on marketplace" : "Hidden — matching only"}
                </span>
                <Toggle on={visible} onChange={setVisible} />
              </div>
            </div>
            <p style={{ fontSize: 12.5, color: "var(--ink-600)", margin: 0, lineHeight: 1.55 }}>
              When visible, clients with marketplace access can find you in browse, view your portfolio, and send direct inquiries. When hidden, you only appear in matched briefs.
            </p>
          </div>

          <div className="card reveal" data-d="2">
            <h3 className="h-display h-3" style={{ margin: "0 0 14px" }}>The basics</h3>
            <div className="stack" style={{ gap: 14 }}>
              <div className="field">
                <label className="field-label">Tagline</label>
                <input className="input" value={tagline} onChange={e => setTagline(e.target.value)} />
                <div className="field-hint">One line, 60 chars max. Shows on every card.</div>
              </div>
              <div className="field">
                <label className="field-label">Bio</label>
                <textarea className="textarea" rows={4} value={bio} onChange={e => setBio(e.target.value)} />
              </div>
              <div className="grid-2">
                <div className="field">
                  <label className="field-label">Hourly rate</label>
                  <div className="input-with-prefix">
                    <span className="prefix">₹</span>
                    <input className="input input-mono" type="number" value={hourly} onChange={e => setHourly(parseInt(e.target.value || 0))} />
                  </div>
                </div>
                <div className="field">
                  <label className="field-label">Response time</label>
                  <select className="select" value={response} onChange={e => setResponse(e.target.value)}>
                    <option>Under 1 hour</option>
                    <option>1 hour</option>
                    <option>A few hours</option>
                    <option>Within 1 day</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="card reveal" data-d="3">
            <h3 className="h-display h-3" style={{ margin: "0 0 14px" }}>Skills, tools &amp; languages</h3>
            <TagEditor label="Skills" tags={skills} setTags={setSkills} placeholder="Add a skill…" />
            <div style={{ height: 14 }}></div>
            <TagEditor label="Tools" tags={tools} setTags={setTools} placeholder="Add a tool…" />
            <div style={{ height: 14 }}></div>
            <TagEditor label="Languages" tags={languages} setTags={setLanguages} placeholder="Add a language…" />
          </div>
        </div>

        {/* Live preview */}
        <div className="stack" style={{ gap: 14 }}>
          <div className="reveal" data-d="2" style={{ position: isMobile ? "static" : "sticky", top: 80 }}>
            <div className="h-eyebrow" style={{ marginBottom: 10 }}>How clients see you</div>
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{
                height: 80,
                background: "linear-gradient(135deg, var(--mint-200), var(--mint-500))",
                position: "relative",
              }}>
                {visible ? (
                  <span className="badge mint" style={{ position: "absolute", top: 10, right: 10, background: "rgba(255,255,255,0.95)", border: "0", color: "var(--mint-800)" }}>
                    <span className="bdot" style={{ background: "var(--mint-600)" }}></span> Online
                  </span>
                ) : (
                  <span className="badge neutral" style={{ position: "absolute", top: 10, right: 10 }}>Hidden</span>
                )}
              </div>
              <div style={{ padding: "16px 18px", position: "relative" }}>
                <div style={{ position: "absolute", top: -28, left: 18 }}>
                  <div style={{ width: 56, height: 56, borderRadius: "50%", border: "3px solid var(--paper)", background: "linear-gradient(135deg, var(--mint-300), var(--mint-700))", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 18 }}>
                    {f.initials}
                  </div>
                </div>
                <div style={{ marginTop: 20 }}>
                  <div className="row" style={{ gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 16, fontWeight: 600, color: "var(--ink-950)" }}>{f.name}</span>
                    <span className="badge dark" style={{ fontSize: 10 }}>{f.level}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--ink-500)", marginBottom: 8 }}>{tagline}</div>
                  <div className="row" style={{ gap: 8, fontSize: 12, color: "var(--ink-700)" }}>
                    <span style={{ color: "var(--amber)" }}><Icon name="star" size={11} strokeWidth={2.4} /></span>
                    <span className="mono" style={{ fontWeight: 500 }}>{f.rating}</span>
                    <span className="muted">({f.reviews})</span>
                    <span className="muted">·</span>
                    <span>{response}</span>
                  </div>
                </div>
                <p style={{ fontSize: 12.5, color: "var(--ink-700)", lineHeight: 1.55, margin: "12px 0 12px" }}>{bio}</p>
                <div className="row wrap" style={{ gap: 4, marginBottom: 14 }}>
                  {skills.slice(0, 3).map(s => <span key={s} className="badge neutral" style={{ fontSize: 10 }}>{s}</span>)}
                  {skills.length > 3 && <span className="badge neutral" style={{ fontSize: 10 }}>+{skills.length - 3}</span>}
                </div>
                <div className="row between" style={{ alignItems: "center" }}>
                  <div>
                    <div className="muted" style={{ fontSize: 11 }}>Starting at</div>
                    <div className="mono" style={{ fontSize: 16, fontWeight: 600, color: "var(--ink-950)" }}>
                      {rupee(window.MM.FREELANCER_PACKAGES[0].price)}
                    </div>
                  </div>
                  <button className="btn primary sm">View profile</button>
                </div>
              </div>
            </div>
            <div className="muted" style={{ fontSize: 11.5, textAlign: "center", marginTop: 10, fontFamily: "var(--font-mono)" }}>
              Live preview · updates as you type
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TagEditor({ label, tags, setTags, placeholder }) {
  const [v, setV] = React.useState("");
  function add() {
    const t = v.trim();
    if (!t || tags.includes(t)) return;
    setTags([...tags, t]);
    setV("");
  }
  return (
    <div>
      <label className="field-label" style={{ display: "block", marginBottom: 6 }}>{label}</label>
      <div className="row wrap" style={{ gap: 6 }}>
        {tags.map(t => (
          <span key={t} className="badge neutral" style={{ padding: "5px 8px 5px 10px", fontSize: 12 }}>
            {t}
            <button onClick={() => setTags(tags.filter(x => x !== t))} style={{ background: "transparent", border: 0, padding: 0, color: "var(--ink-500)", marginLeft: 4, cursor: "pointer" }}>
              <Icon name="x" size={10} />
            </button>
          </span>
        ))}
        <input
          className="input"
          style={{ width: 160, padding: "5px 10px", fontSize: 12 }}
          placeholder={placeholder}
          value={v}
          onChange={e => setV(e.target.value)}
          onKeyDown={e => e.key === "Enter" && (e.preventDefault(), add())}
        />
      </div>
    </div>
  );
}

// ===== Packages editor =====
function PackagesEditor({ isMobile, pushToast }) {
  const [pkgs, setPkgs] = React.useState(window.MM.FREELANCER_PACKAGES);
  const [active, setActive] = React.useState(1); // index

  function updateField(idx, key, value) {
    setPkgs(p => p.map((pk, i) => i === idx ? { ...pk, [key]: value } : pk));
  }
  function updateInclusion(idx, lineIdx, value) {
    setPkgs(p => p.map((pk, i) => i === idx ? { ...pk, inclusions: pk.inclusions.map((s, j) => j === lineIdx ? value : s) } : pk));
  }
  function addInclusion(idx) {
    setPkgs(p => p.map((pk, i) => i === idx ? { ...pk, inclusions: [...pk.inclusions, "New inclusion"] } : pk));
  }
  function removeInclusion(idx, lineIdx) {
    setPkgs(p => p.map((pk, i) => i === idx ? { ...pk, inclusions: pk.inclusions.filter((_, j) => j !== lineIdx) } : pk));
  }

  return (
    <div className="stack-6">
      <div className="row between reveal" data-d="0">
        <div>
          <div className="h-eyebrow" style={{ marginBottom: 4 }}>Marketplace</div>
          <h1 className="h-display h-1" style={{ margin: 0 }}>Packages</h1>
          <p className="muted" style={{ marginTop: 6 }}>Three tiers shown on your profile. Editing one updates the live preview below.</p>
        </div>
        <button className="btn primary" onClick={() => pushToast({ title: "Packages saved", body: "Live on your profile." })}>
          <Icon name="check" /> Save all
        </button>
      </div>

      {isMobile && (
        <Tabs value={active} onChange={setActive}
          items={pkgs.map((p, i) => ({ value: i, label: p.tier }))}
        />
      )}

      <div className={isMobile ? "" : "grid-3"} style={{ gap: 14 }}>
        {pkgs.map((p, i) => {
          if (isMobile && i !== active) return null;
          return (
            <div key={p.tier} className="card reveal" data-d={1 + i} style={{ padding: 18, position: "relative" }}>
              {p.popular && (
                <span className="badge mint" style={{ position: "absolute", top: -10, left: 18, background: "var(--mint-600)", color: "white", border: "0" }}>
                  Most popular
                </span>
              )}
              <div className="h-eyebrow" style={{ marginBottom: 6 }}>{p.tier}</div>
              <input
                className="input"
                style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600, padding: 0, border: 0, background: "transparent", marginBottom: 8 }}
                value={p.name}
                onChange={e => updateField(i, "name", e.target.value)}
              />
              <textarea
                className="textarea"
                rows={2}
                style={{ fontSize: 12.5, padding: 0, border: 0, background: "transparent", minHeight: 0, marginBottom: 14, color: "var(--ink-600)" }}
                value={p.description}
                onChange={e => updateField(i, "description", e.target.value)}
              />

              <div style={{ background: "var(--paper-tint)", border: "1px solid var(--hairline)", borderRadius: "var(--radius-md)", padding: 12, marginBottom: 12 }}>
                <div className="row between" style={{ alignItems: "baseline" }}>
                  <span className="muted" style={{ fontSize: 11 }}>Price</span>
                  <div className="input-with-prefix" style={{ background: "transparent", border: 0 }}>
                    <span className="prefix" style={{ position: "static", color: "var(--ink-500)" }}>₹</span>
                    <input className="input input-mono" type="number" value={p.price} onChange={e => updateField(i, "price", parseInt(e.target.value || 0))}
                      style={{ fontSize: 22, fontWeight: 600, color: "var(--ink-950)", border: 0, padding: 0, textAlign: "right", background: "transparent", maxWidth: 140 }}
                    />
                  </div>
                </div>
                <div className="row between" style={{ alignItems: "center", marginTop: 8 }}>
                  <span className="muted" style={{ fontSize: 11 }}>Delivery</span>
                  <div className="row" style={{ gap: 4 }}>
                    <input className="input input-mono" type="number" value={p.delivery_days} onChange={e => updateField(i, "delivery_days", parseInt(e.target.value || 0))}
                      style={{ fontSize: 13, padding: "4px 6px", maxWidth: 50, textAlign: "right" }}
                    />
                    <span style={{ fontSize: 12, color: "var(--ink-700)" }}>days</span>
                  </div>
                </div>
                <div className="row between" style={{ alignItems: "center", marginTop: 6 }}>
                  <span className="muted" style={{ fontSize: 11 }}>Revisions</span>
                  <input className="input input-mono" type="number" value={p.revisions} onChange={e => updateField(i, "revisions", parseInt(e.target.value || 0))}
                    style={{ fontSize: 13, padding: "4px 6px", maxWidth: 50, textAlign: "right" }}
                  />
                </div>
              </div>

              <div className="h-eyebrow" style={{ marginBottom: 8 }}>Inclusions</div>
              <div className="stack" style={{ gap: 4 }}>
                {p.inclusions.map((inc, j) => (
                  <div key={j} className="row" style={{ gap: 8, alignItems: "center" }}>
                    <Icon name="check" size={12} style={{ color: "var(--mint-700)", flexShrink: 0 }} />
                    <input
                      className="input"
                      style={{ border: 0, padding: "4px 6px", fontSize: 12.5, background: "transparent", flex: 1 }}
                      value={inc}
                      onChange={e => updateInclusion(i, j, e.target.value)}
                    />
                    <button onClick={() => removeInclusion(i, j)} style={{ background: "transparent", border: 0, color: "var(--ink-400)", cursor: "pointer", padding: 4 }}>
                      <Icon name="x" size={10} />
                    </button>
                  </div>
                ))}
                <button className="btn link sm" onClick={() => addInclusion(i)} style={{ alignSelf: "flex-start", padding: "4px 0", fontSize: 12 }}>
                  <Icon name="plus" size={11} /> Add inclusion
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="card-tint reveal" data-d="4" style={{ padding: 16 }}>
        <div className="row" style={{ gap: 12 }}>
          <div style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 8, background: "var(--paper)", color: "var(--ink-700)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name="sparkles" />
          </div>
          <div>
            <div style={{ fontWeight: 500, color: "var(--ink-950)", marginBottom: 2 }}>Tip · Make Standard your hero</div>
            <div style={{ fontSize: 12.5, color: "var(--ink-700)", lineHeight: 1.55 }}>
              Most clients book the middle tier. Make sure your Standard package is detailed, with clear inclusions and a “Most popular” call-out — it converts 3× better than Basic.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== Portfolio manager =====
function PortfolioManager({ isMobile, pushToast }) {
  const [items, setItems] = React.useState(window.MM.FREELANCER_PORTFOLIO);
  const [showAdd, setShowAdd] = React.useState(false);

  return (
    <div className="stack-6">
      <div className="row between reveal" data-d="0">
        <div>
          <div className="h-eyebrow" style={{ marginBottom: 4 }}>Marketplace</div>
          <h1 className="h-display h-1" style={{ margin: 0 }}>Portfolio</h1>
          <p className="muted" style={{ marginTop: 6 }}>{items.length} pieces · Featured items appear first on your profile.</p>
        </div>
        <button className="btn primary" onClick={() => setShowAdd(true)}>
          <Icon name="plus" /> Add work
        </button>
      </div>

      <div className={isMobile ? "grid-4" : "grid-3"} style={{ gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3, 1fr)", gap: 14 }}>
        {items.map((p, i) => (
          <div key={p.id} className="card reveal" data-d={1 + i} style={{ padding: 0, overflow: "hidden", position: "relative" }}>
            <div style={{ aspectRatio: "4 / 3", background: p.swatch, position: "relative" }}>
              {p.featured && (
                <span className="badge dark" style={{ position: "absolute", top: 10, left: 10, fontSize: 10 }}>
                  <Icon name="star" size={10} strokeWidth={2.4} /> Featured
                </span>
              )}
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 60%, rgba(0,0,0,0.4))", display: "flex", alignItems: "flex-end", padding: 10 }}>
                <span className="badge neutral" style={{ background: "rgba(255,255,255,0.92)", border: 0, fontSize: 10 }}>{p.category}</span>
              </div>
            </div>
            <div style={{ padding: 12 }}>
              <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--ink-950)", lineHeight: 1.3, marginBottom: 6 }}>{p.title}</div>
              <div className="row between" style={{ fontSize: 11, color: "var(--ink-500)" }}>
                <span>{p.duration}</span>
                <span className="mono" style={{ fontWeight: 500, color: "var(--ink-900)" }}>{p.price_range}</span>
              </div>
              <div className="divider" style={{ margin: "10px 0 8px" }}></div>
              <div className="row" style={{ gap: 4 }}>
                <button className="btn link sm" style={{ padding: "2px 6px", fontSize: 11 }}><Icon name="edit" size={10} /> Edit</button>
                <button className="btn link sm" style={{ padding: "2px 6px", fontSize: 11 }}>
                  <Icon name={p.featured ? "star" : "star"} size={10} /> {p.featured ? "Unfeature" : "Feature"}
                </button>
                <button className="btn link sm" style={{ padding: "2px 6px", fontSize: 11, color: "var(--rose)", marginLeft: "auto" }}><Icon name="trash" size={10} /></button>
              </div>
            </div>
          </div>
        ))}

        {/* Add new tile */}
        <button onClick={() => setShowAdd(true)} className="reveal" data-d={1 + items.length} style={{
          background: "transparent",
          border: "1.5px dashed var(--hairline-strong)",
          borderRadius: "var(--radius-md)",
          padding: 0,
          cursor: "pointer",
          aspectRatio: "4 / 3.5",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          color: "var(--ink-500)",
          fontFamily: "inherit",
          minHeight: 200,
        }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--paper-tint)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name="plus" size={18} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-700)" }}>Add new piece</span>
          <span style={{ fontSize: 11 }}>up to 10 media files</span>
        </button>
      </div>

      {showAdd && (
        <Modal title="Add portfolio piece" subtitle="Cover image is required. Everything else is optional but helps clients evaluate." onClose={() => setShowAdd(false)} maxWidth={560}
          footer={
            <>
              <button className="btn ghost" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn primary" onClick={() => { setShowAdd(false); pushToast({ title: "Portfolio piece added", body: "Now visible on your profile." }); }}>
                <Icon name="check" /> Publish
              </button>
            </>
          }
        >
          <div className="stack" style={{ gap: 14 }}>
            <div className="field">
              <label className="field-label">Title</label>
              <input className="input" placeholder="e.g. Kindred — founder reel series" />
            </div>
            <div className="grid-2">
              <div className="field">
                <label className="field-label">Category</label>
                <select className="select" defaultValue="Reels">
                  <option>Reels</option>
                  <option>Brand films</option>
                  <option>Product photography</option>
                  <option>Branding</option>
                </select>
              </div>
              <div className="field">
                <label className="field-label">Price range</label>
                <input className="input" placeholder="e.g. ₹15K — ₹25K" />
              </div>
            </div>
            <div className="field">
              <label className="field-label">Cover media</label>
              <div style={{ border: "1.5px dashed var(--hairline-strong)", borderRadius: "var(--radius-md)", padding: 22, textAlign: "center", background: "var(--paper-tint)" }}>
                <Icon name="upload" size={18} className="muted" />
                <div style={{ fontSize: 13, color: "var(--ink-700)", marginTop: 6 }}>
                  Drag &amp; drop cover, or <span style={{ color: "var(--ink-950)", textDecoration: "underline" }}>browse</span>
                </div>
                <div className="field-hint">PNG, JPG, MP4 · up to 50MB</div>
              </div>
            </div>
            <div className="field">
              <label className="field-label">Description</label>
              <textarea className="textarea" rows={3} placeholder="What was the brief, what did you deliver, what made it work?" />
            </div>
            <div className="row between" style={{ paddingTop: 6 }}>
              <div className="row" style={{ gap: 8 }}>
                <Toggle on={true} onChange={() => {}} />
                <span style={{ fontSize: 13, color: "var(--ink-800)" }}>Feature on profile</span>
              </div>
              <span className="field-hint">Featured pieces appear first</span>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ===== Notifications inbox (Phase 2) =====
function NotificationsInbox({ onNav, isMobile, pushToast }) {
  const [filter, setFilter] = React.useState("all");
  const [items, setItems] = React.useState(window.MM.NOTIFS_FULL);

  const counts = {
    all:      items.length,
    unread:   items.filter(n => n.unread).length,
    jobs:     items.filter(n => ["match", "offer", "delivery", "admin"].includes(n.type)).length,
    wallet:   items.filter(n => n.type === "wallet").length,
    system:   items.filter(n => ["system", "ai"].includes(n.type)).length,
  };
  const filtered = items.filter(n => {
    if (filter === "all") return true;
    if (filter === "unread") return n.unread;
    if (filter === "jobs") return ["match", "offer", "delivery", "admin"].includes(n.type);
    if (filter === "wallet") return n.type === "wallet";
    if (filter === "system") return ["system", "ai"].includes(n.type);
    return true;
  });

  function markRead(id) {
    setItems(list => list.map(n => n.id === id ? { ...n, unread: false } : n));
  }
  function markAllRead() {
    setItems(list => list.map(n => ({ ...n, unread: false })));
    pushToast({ title: "All caught up", body: "Marked everything as read." });
  }

  return (
    <div className="stack-6">
      <div className="row between reveal" data-d="0">
        <div>
          <div className="h-eyebrow" style={{ marginBottom: 4 }}>Inbox</div>
          <h1 className="h-display h-1" style={{ margin: 0 }}>Notifications</h1>
          <p className="muted" style={{ marginTop: 6 }}>
            {counts.unread > 0 ? (
              <>You have <strong style={{ color: "var(--ink-900)" }}>{counts.unread} unread</strong> · live sync via Mintmore</>
            ) : (
              <>You're all caught up · live sync via Mintmore</>
            )}
          </p>
        </div>
        <button className="btn ghost" onClick={markAllRead} disabled={counts.unread === 0}>
          <Icon name="check" /> Mark all read
        </button>
      </div>

      <div className="row between reveal" data-d="1" style={{ flexWrap: "wrap", gap: 8 }}>
        <Tabs
          value={filter}
          onChange={setFilter}
          items={[
            { value: "all",    label: "All",     count: counts.all },
            { value: "unread", label: "Unread",  count: counts.unread },
            { value: "jobs",   label: "Jobs",    count: counts.jobs },
            { value: "wallet", label: "Wallet",  count: counts.wallet },
            { value: "system", label: "System",  count: counts.system },
          ]}
        />
        <div className="row" style={{ gap: 8, fontSize: 12, color: "var(--ink-500)" }}>
          <span className="pulse-dot" style={{ width: 6, height: 6 }}></span>
          <span style={{ fontFamily: "var(--font-mono)" }}>Live</span>
        </div>
      </div>

      <div className="card reveal" data-d="2" style={{ padding: 0, overflow: "hidden" }}>
        {filtered.length === 0 ? (
          <div className="empty" style={{ border: 0, padding: 48 }}>
            <div className="empty-glyph"><Icon name="bell" /></div>
            <h3>No notifications</h3>
            <p>Nothing in this filter right now.</p>
          </div>
        ) : (
          filtered.map((n, i) => (
            <button
              key={n.id}
              onClick={() => {
                markRead(n.id);
                if (n.jobId) onNav("job-detail", n.jobId);
                else if (n.type === "wallet") onNav("wallet");
              }}
              style={{
                display: "flex", gap: 14, alignItems: "flex-start",
                padding: "14px 18px",
                width: "100%", textAlign: "left",
                background: n.unread ? "var(--mint-50)" : "transparent",
                border: 0,
                borderTop: i === 0 ? "0" : "1px solid var(--hairline)",
                cursor: "pointer",
                transition: "background 0.12s ease",
                position: "relative",
                fontFamily: "inherit",
              }}
            >
              {n.unread && (
                <span style={{ position: "absolute", left: 8, top: "50%", width: 4, height: 4, borderRadius: "50%", background: "var(--mint-600)", transform: "translateY(-50%)" }}></span>
              )}
              <NotifIcon type={n.type} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--ink-950)" }}>{n.title}</div>
                <div style={{ fontSize: 12.5, color: "var(--ink-600)", marginTop: 2 }}>{n.body}</div>
                <div style={{ fontSize: 11, color: "var(--ink-400)", marginTop: 4, fontFamily: "var(--font-mono)" }}>{n.ts}</div>
              </div>
              {n.jobId && (
                <span style={{ fontSize: 11, color: "var(--ink-500)", alignSelf: "center" }}>
                  <Icon name="arrowRight" size={12} />
                </span>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

Object.assign(window, {
  MarketplaceProfile, PackagesEditor, PortfolioManager, NotificationsInbox
});
