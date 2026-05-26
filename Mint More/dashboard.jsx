// Client dashboard

function Dashboard({ onNav, isMobile, onTopUp }) {
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const activeJobs = window.MM.JOBS.filter(j => ["matching", "negotiating", "in_progress"].includes(j.status));
  const completedCount = window.MM.JOBS.filter(j => j.status === "completed").length;

  return (
    <div className="stack-6">
      {/* Greeting */}
      <div className="reveal" data-d="0">
        <div className="h-eyebrow" style={{ marginBottom: 4 }}>
          {now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
        </div>
        <h1 className="h-display" style={{ fontSize: isMobile ? 26 : 30, margin: 0, lineHeight: 1.15 }}>
          {greeting}, {window.MM.USER.name.split(" ")[0]}.
        </h1>
        <p className="muted" style={{ marginTop: 6, fontSize: 14 }}>
          You have <strong style={{ color: "var(--ink-900)" }}>1 job awaiting your move</strong> and a counter offer from Arjun.
        </p>
      </div>

      {/* Hero strip — wallet + quick actions */}
      <div className={isMobile ? "stack" : "grid-2"} style={{ gridTemplateColumns: isMobile ? undefined : "1.4fr 1fr", gap: 14 }}>
        <div className="card-ink reveal" data-d="1" style={{ position: "relative", overflow: "hidden" }}>
          <div style={{
            position: "absolute", inset: 0,
            background: "radial-gradient(circle at 80% 20%, rgba(16, 185, 129, 0.18), transparent 50%)",
          }}></div>
          <div style={{ position: "relative" }}>
            <div className="row between" style={{ marginBottom: 18 }}>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", letterSpacing: 0.04, textTransform: "uppercase" }}>
                Wallet balance
              </span>
              <span className="badge mint" style={{ background: "rgba(16, 185, 129, 0.18)", border: "1px solid rgba(16, 185, 129, 0.3)", color: "var(--mint-200)" }}>
                <span className="bdot" style={{ background: "var(--mint-300)" }}></span>
                Escrow-protected
              </span>
            </div>
            <div className="row" style={{ alignItems: "baseline", gap: 10 }}>
              <span className="mono" style={{ fontFamily: "var(--font-display)", fontSize: isMobile ? 38 : 44, fontWeight: 500, letterSpacing: "-0.02em" }}>
                ₹12,450
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "rgba(255,255,255,0.5)" }}>.00</span>
            </div>
            <div className="row" style={{ gap: 20, marginTop: 14, fontSize: 12 }}>
              <div>
                <div style={{ color: "rgba(255,255,255,0.5)" }}>Available</div>
                <div className="mono" style={{ color: "white", marginTop: 2 }}>₹12,450</div>
              </div>
              <div style={{ width: 1, height: 26, background: "rgba(255,255,255,0.1)" }}></div>
              <div>
                <div style={{ color: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center", gap: 4 }}>
                  <Icon name="lock" size={11} /> In escrow
                </div>
                <div className="mono" style={{ color: "white", marginTop: 2 }}>₹8,500</div>
              </div>
              <div style={{ width: 1, height: 26, background: "rgba(255,255,255,0.1)" }}></div>
              <div>
                <div style={{ color: "rgba(255,255,255,0.5)" }}>Total</div>
                <div className="mono" style={{ color: "var(--mint-300)", marginTop: 2, fontWeight: 600 }}>₹20,950</div>
              </div>
            </div>
            <div className="row" style={{ marginTop: 22, gap: 8 }}>
              <button className="btn mint" onClick={onTopUp}>
                <Icon name="plus" /> Top up wallet
              </button>
              <button className="btn link" style={{ color: "rgba(255,255,255,0.85)" }} onClick={() => onNav("wallet")}>
                View transactions <Icon name="arrowRight" />
              </button>
            </div>
          </div>
        </div>

        <div className="reveal" data-d="2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <QuickAction icon="plus" label="Post a new brief" sub="Get matched in ~6 min" onClick={() => onNav("post-job")} primary />
          <QuickAction icon="user" label="Browse freelancers" sub="Marketplace access" onClick={() => onNav("freelancers")} />
          <QuickAction icon="sparkles" label="Mint AI" sub="Captions, scripts, images" onClick={() => onNav("mintai")} />
          <QuickAction icon="layers" label="Schedule a post" sub="2 platforms connected" onClick={() => onNav("social")} />
        </div>
      </div>

      {/* Stat grid */}
      <div className={isMobile ? "grid-4" : "grid-4"} style={{ gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)" }}>
        <StatTile delay={3} label="Active jobs" value="3" hint="of 5 slots used" />
        <StatTile delay={4} label="Awaiting your move" value="1" hint="counter offer pending" tone="amber" />
        <StatTile delay={5} label="Completed" value={`${completedCount}`} hint="last 90 days" />
        <StatTile delay={6} label="Spent this month" value="₹67,000" hint="vs ₹54,200 last" mono />
      </div>

      {/* Active jobs */}
      <div className="stack reveal" data-d="3">
        <div className="row between" style={{ alignItems: "flex-end" }}>
          <div>
            <h2 className="h-display h-3" style={{ margin: 0 }}>Active jobs</h2>
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>What's moving through Mintmore right now</div>
          </div>
          <button className="btn link sm" onClick={() => onNav("jobs")}>
            See all <Icon name="arrowRight" size={12} />
          </button>
        </div>

        <div className={isMobile ? "stack" : "grid-3"} style={{ gap: 10 }}>
          {activeJobs.map((j, i) => (
            <button key={j.id} className="job-card reveal" data-d={4 + i} onClick={() => onNav("job-detail", j.id)}>
              <div className="row between">
                <span className="h-eyebrow" style={{ color: "var(--ink-500)" }}>{j.category}</span>
                <StatusChip status={j.status} />
              </div>
              <div className="title">{j.title}</div>
              <div className="description">{j.description}</div>
              <div className="divider" style={{ margin: "12px 0 8px" }}></div>
              <div className="row between" style={{ fontSize: 11.5 }}>
                <span className="muted">Deadline {j.deadline}</span>
                <span className="mono" style={{ color: "var(--ink-900)", fontWeight: 500 }}>
                  {j.pricing_mode === "budget" ? rupee(j.budget) : `~${rupee(j.budget)}`}
                </span>
              </div>
              {j.status === "matching" && (
                <div className="row" style={{ marginTop: 10, color: "var(--mint-700)", fontSize: 11.5, fontWeight: 500 }}>
                  <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "var(--mint-500)", boxShadow: "0 0 0 3px var(--mint-100)" }}></span>
                  {j.matches_found} candidates short-listed · still searching
                </div>
              )}
              {j.status === "negotiating" && (
                <div className="row" style={{ marginTop: 10, color: "var(--amber)", fontSize: 11.5, fontWeight: 500 }}>
                  <Icon name="zap" size={11} />
                  Counter offer waiting · Round {j.current_round} of {j.max_rounds}
                </div>
              )}
              {j.status === "in_progress" && (
                <div className="row" style={{ marginTop: 10, fontSize: 11.5 }}>
                  <Avatar initials={j.matched_freelancer.initials} size="sm" />
                  <span style={{ color: "var(--ink-700)" }}>{j.matched_freelancer.name}</span>
                  <span className="muted">· {j.progress}% done</span>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Notifications row */}
      <div className={isMobile ? "stack" : "grid-2"} style={{ gap: 14 }}>
        <div className="card reveal" data-d="5">
          <div className="row between" style={{ marginBottom: 14 }}>
            <h3 className="h-display h-3" style={{ margin: 0 }}>Recent activity</h3>
            <button className="btn link sm" style={{ fontSize: 11 }}>Mark all read</button>
          </div>
          <div className="stack" style={{ gap: 0 }}>
            {window.MM.NOTIFS.map((n, i) => (
              <div key={n.id} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "10px 0", borderTop: i === 0 ? "0" : "1px solid var(--hairline)" }}>
                <NotifIcon type={n.type} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-950)" }}>{n.title}</div>
                  <div style={{ fontSize: 12, color: "var(--ink-500)", marginTop: 1 }}>{n.body}</div>
                </div>
                <div style={{ fontSize: 11, color: "var(--ink-400)", fontFamily: "var(--font-mono)" }}>{n.time}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card-mint reveal" data-d="6" style={{ position: "relative", overflow: "hidden" }}>
          <div className="row between" style={{ marginBottom: 6 }}>
            <span className="h-eyebrow" style={{ color: "var(--mint-800)" }}>Tip · Marketplace</span>
            <Icon name="sparkles" style={{ color: "var(--mint-700)" }} size={14} />
          </div>
          <h3 className="h-display" style={{ fontSize: 17, margin: "4px 0 8px", color: "var(--ink-950)" }}>
            Unlock browse access for ₹599
          </h3>
          <p style={{ fontSize: 12.5, color: "var(--ink-700)", lineHeight: 1.55, margin: "0 0 14px" }}>
            Skip matching and reach out directly to top creatives across India.
            30 days of unlimited browse + 5 direct inquiries.
          </p>
          <div className="row">
            <button className="btn mint sm">
              Unlock for ₹599 <Icon name="arrowRight" size={12} />
            </button>
            <button className="btn link sm">Learn more</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickAction({ icon, label, sub, onClick, primary }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: primary ? "var(--paper)" : "var(--paper)",
        border: "1px solid var(--hairline)",
        borderRadius: "var(--radius-md)",
        padding: 12,
        textAlign: "left",
        cursor: "pointer",
        transition: "all 0.12s ease",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        minHeight: 88,
      }}
      onMouseEnter={e => e.currentTarget.style.borderColor = "var(--ink-300)"}
      onMouseLeave={e => e.currentTarget.style.borderColor = "var(--hairline)"}
    >
      <div style={{
        width: 28, height: 28, borderRadius: 8,
        background: primary ? "var(--ink-950)" : "var(--paper-tint)",
        color: primary ? "white" : "var(--ink-700)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Icon name={icon} size={14} />
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-950)" }}>{label}</div>
        <div style={{ fontSize: 11.5, color: "var(--ink-500)", marginTop: 2 }}>{sub}</div>
      </div>
    </button>
  );
}

function StatTile({ label, value, hint, tone, mono, delay = 0 }) {
  return (
    <div className="stat-tile reveal" data-d={delay}>
      <div className="row between">
        <span className="label">{label}</span>
        {tone === "amber" && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--amber)", boxShadow: "0 0 0 3px var(--amber-bg)" }}></span>}
      </div>
      <div className="value" style={{ fontFamily: mono ? "var(--font-mono)" : undefined }}>{value}</div>
      {hint && <div style={{ fontSize: 11, color: "var(--ink-500)" }}>{hint}</div>}
    </div>
  );
}

function NotifIcon({ type }) {
  const map = {
    match: { icon: "radar", bg: "var(--violet-bg)", color: "var(--violet)" },
    offer: { icon: "zap", bg: "var(--amber-bg)", color: "var(--amber)" },
    delivery: { icon: "image", bg: "var(--mint-50)", color: "var(--mint-700)" },
    wallet: { icon: "wallet", bg: "var(--paper-tint)", color: "var(--ink-700)" },
  };
  const m = map[type] || map.wallet;
  return (
    <div style={{
      width: 28, height: 28, borderRadius: 8,
      background: m.bg, color: m.color,
      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
    }}>
      <Icon name={m.icon} size={13} />
    </div>
  );
}

Object.assign(window, { Dashboard, QuickAction, StatTile, NotifIcon });
