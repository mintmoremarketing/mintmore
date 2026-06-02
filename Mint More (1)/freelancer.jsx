// Freelancer dashboard, jobs list, job detail, and inquiries

// ===== Dashboard =====
function FreelancerDashboard({ onNav, isMobile }) {
  const f = window.MM.FREELANCER;
  const totalEarn = window.MM.FREELANCER_EARNINGS_30D.reduce((a, b) => a + b, 0);
  const max = Math.max(...window.MM.FREELANCER_EARNINGS_30D);
  const newMatch = window.MM.FREELANCER_JOBS.find(j => j.status === "matching" && j.new_match);

  return (
    <div className="stack-6">
      <div className="reveal" data-d="0">
        <div className="h-eyebrow" style={{ marginBottom: 4 }}>
          {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
        </div>
        <h1 className="h-display" style={{ fontSize: isMobile ? 26 : 30, margin: 0 }}>
          Welcome back, {f.name.split(" ")[0]}.
        </h1>
        <p className="muted" style={{ marginTop: 6 }}>
          <strong style={{ color: "var(--ink-900)" }}>1 new match</strong> and{" "}
          <strong style={{ color: "var(--ink-900)" }}>2 direct inquiries</strong> waiting on you.
        </p>
      </div>

      {/* New match hero */}
      {newMatch && (
        <div className="card-ink reveal" data-d="1" style={{ position: "relative", overflow: "hidden", padding: 22 }}>
          <div style={{ position: "absolute", inset: 0,
            background: "radial-gradient(circle at 85% 25%, rgba(16, 185, 129, 0.22), transparent 50%)" }}></div>
          <div style={{ position: "relative" }}>
            <div className="row between" style={{ marginBottom: 14 }}>
              <span className="badge mint" style={{ background: "rgba(16,185,129,0.18)", color: "var(--mint-200)", border: "1px solid rgba(16,185,129,0.3)" }}>
                <span className="pulse-dot" style={{ width: 6, height: 6 }}></span>
                New match · 12m ago
              </span>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontFamily: "var(--font-mono)" }}>Budget {newMatch.budget_range}</span>
            </div>
            <h2 className="h-display" style={{ fontSize: isMobile ? 18 : 22, margin: "0 0 8px", color: "white", letterSpacing: "-0.01em" }}>{newMatch.title}</h2>
            <div className="row" style={{ gap: 8, marginBottom: 12 }}>
              <Avatar initials={newMatch.client.initials} size="sm" />
              <span style={{ color: "rgba(255,255,255,0.85)", fontSize: 13 }}>{newMatch.client.name}</span>
              <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>· {newMatch.client.business}</span>
            </div>
            <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, lineHeight: 1.55, margin: "0 0 16px", maxWidth: 600 }}>
              {newMatch.description}
            </p>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn mint" onClick={() => onNav("job-detail", newMatch.id)}>
                Review &amp; respond <Icon name="arrowRight" />
              </button>
              <button className="btn link" style={{ color: "rgba(255,255,255,0.7)" }}>Pass on this brief</button>
            </div>
          </div>
        </div>
      )}

      {/* Stat row */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 14 }}>
        <SlotsTile delay={2} active={f.active_slots} max={f.max_slots} />
        <StatTile delay={3} label="Earnings · 30d" value={rupee(totalEarn)} hint="vs ₹98,500 prior" mono />
        <StatTile delay={4} label="Avg rating" value={`${f.rating} ★`} hint={`${f.reviews} reviews`} />
        <StatTile delay={5} label="Response time" value={f.response_time} hint="across all inbound" />
      </div>

      <div className={isMobile ? "stack" : ""} style={{ display: isMobile ? "flex" : "grid", gridTemplateColumns: isMobile ? undefined : "1.4fr 1fr", gap: 14 }}>
        {/* Earnings sparkline */}
        <div className="card reveal" data-d="6" style={{ padding: 20 }}>
          <div className="row between" style={{ marginBottom: 4 }}>
            <div>
              <div className="h-eyebrow" style={{ marginBottom: 4 }}>Earnings · last 30 days</div>
              <div className="mono" style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 500, color: "var(--ink-950)", letterSpacing: "-0.02em" }}>
                {rupee(totalEarn)}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="row" style={{ gap: 4, color: "var(--mint-700)", fontSize: 12, fontWeight: 500 }}>
                <Icon name="trending" size={12} /> +24%
              </div>
              <div className="muted" style={{ fontSize: 11 }}>vs prior 30d</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 80, marginTop: 18 }}>
            {window.MM.FREELANCER_EARNINGS_30D.map((v, i) => (
              <div key={i} style={{
                flex: 1,
                height: max ? `${Math.max(2, (v / max) * 100)}%` : 2,
                background: v > 0 ? "var(--mint-500)" : "var(--paper-deep)",
                borderRadius: 2,
                opacity: v > 0 ? 1 : 0.5,
              }}></div>
            ))}
          </div>
          <div className="row between" style={{ marginTop: 6, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-400)" }}>
            <span>30 days ago</span>
            <span>Today</span>
          </div>
        </div>

        {/* Quick links */}
        <div className="reveal" data-d="7" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <QuickAction icon="user"      label="Edit profile"        sub="Marketplace visibility" onClick={() => onNav("profile-edit")} primary />
          <QuickAction icon="layers"    label="Packages"            sub="3 active tiers"         onClick={() => onNav("packages")} />
          <QuickAction icon="image"     label="Portfolio"           sub={`${window.MM.FREELANCER_PORTFOLIO.length} items`} onClick={() => onNav("portfolio")} />
          <QuickAction icon="wallet"    label="Withdraw"            sub={`${rupee(window.MM.FREELANCER_WALLET.withdrawable)} available`} onClick={() => onNav("wallet")} />
        </div>
      </div>

      {/* Active jobs + inquiries */}
      <div className="stack reveal" data-d="8">
        <div className="row between">
          <h2 className="h-display h-3" style={{ margin: 0 }}>Active work</h2>
          <button className="btn link sm" onClick={() => onNav("jobs")}>See all <Icon name="arrowRight" size={12} /></button>
        </div>
        <div className={isMobile ? "stack" : "grid-3"} style={{ gap: 10 }}>
          {window.MM.FREELANCER_JOBS.filter(j => ["matching", "negotiating", "in_progress"].includes(j.status)).map((j, i) => (
            <FreelancerJobCard key={j.id} job={j} onOpen={() => onNav("job-detail", j.id)} />
          ))}
        </div>
      </div>

      {/* Inquiries strip */}
      <div className="stack reveal" data-d="9">
        <div className="row between">
          <div>
            <h2 className="h-display h-3" style={{ margin: 0 }}>Direct inquiries</h2>
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>Clients who reached out via the marketplace</div>
          </div>
          <button className="btn link sm" onClick={() => onNav("inquiries")}>See all <Icon name="arrowRight" size={12} /></button>
        </div>
        <div className={isMobile ? "stack" : "grid-2"} style={{ gap: 10 }}>
          {window.MM.FREELANCER_INQUIRIES.map(iq => (
            <div key={iq.id} className="card" style={{ padding: 14 }}>
              <div className="row between" style={{ marginBottom: 10 }}>
                <div className="row" style={{ gap: 10 }}>
                  <Avatar initials={iq.client.initials} />
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 500 }}>{iq.client.name}</div>
                    <div style={{ fontSize: 11.5, color: "var(--ink-500)" }}>{iq.client.business}</div>
                  </div>
                </div>
                <span className="badge mint">{iq.package} pkg</span>
              </div>
              <p style={{ fontSize: 12.5, color: "var(--ink-700)", lineHeight: 1.55, margin: "0 0 12px" }}>{iq.message}</p>
              <div className="row between" style={{ fontSize: 11.5, marginBottom: 12 }}>
                <span className="muted">Budget</span>
                <span className="mono" style={{ fontWeight: 500, color: "var(--ink-950)" }}>{rupee(iq.budget)} · {iq.deadline_days} days</span>
              </div>
              <div className="row" style={{ gap: 6 }}>
                <button className="btn mint sm" style={{ flex: 1 }}>Respond</button>
                <button className="btn ghost sm">Decline</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SlotsTile({ active, max, delay }) {
  const cells = Array(max).fill(0);
  return (
    <div className="stat-tile reveal" data-d={delay}>
      <span className="label">Active slots</span>
      <div className="row" style={{ alignItems: "baseline", gap: 4 }}>
        <span className="value">{active}</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--ink-400)" }}>/ {max}</span>
      </div>
      <div className="row" style={{ gap: 4 }}>
        {cells.map((_, i) => (
          <div key={i} style={{
            flex: 1, height: 6, borderRadius: 2,
            background: i < active ? "var(--mint-500)" : "var(--paper-deep)",
          }}></div>
        ))}
      </div>
    </div>
  );
}

function FreelancerJobCard({ job, onOpen }) {
  return (
    <button className="job-card" onClick={onOpen} style={{ position: "relative" }}>
      {job.new_match && (
        <span className="badge mint" style={{ position: "absolute", top: 12, right: 12, fontSize: 10 }}>
          <span className="bdot"></span> New match
        </span>
      )}
      <div className="row" style={{ gap: 8 }}>
        <span className="h-eyebrow" style={{ color: "var(--ink-500)" }}>{job.category}</span>
        <StatusChip status={job.status} />
      </div>
      <div className="title">{job.title}</div>
      <div className="row" style={{ gap: 8, fontSize: 12, color: "var(--ink-500)", marginTop: 8 }}>
        <Avatar initials={job.client.initials} size="sm" />
        <span>{job.client.business}</span>
      </div>
      <div className="divider" style={{ margin: "10px 0 8px" }}></div>
      <div className="row between" style={{ fontSize: 11.5 }}>
        <span className="muted">{job.deadline}</span>
        <span className="mono" style={{ color: "var(--ink-950)", fontWeight: 500 }}>{job.budget_range}</span>
      </div>
    </button>
  );
}

// ===== Jobs list (freelancer view) =====
function FreelancerJobsList({ onNav, isMobile }) {
  const [tab, setTab] = React.useState("all");
  const filtered = window.MM.FREELANCER_JOBS.filter(j => {
    if (tab === "all") return true;
    if (tab === "active") return ["matching", "negotiating", "in_progress"].includes(j.status);
    return j.status === tab;
  });

  const counts = {
    all: window.MM.FREELANCER_JOBS.length,
    matching: window.MM.FREELANCER_JOBS.filter(j => j.status === "matching").length,
    active: window.MM.FREELANCER_JOBS.filter(j => ["negotiating", "in_progress"].includes(j.status)).length,
    completed: window.MM.FREELANCER_JOBS.filter(j => j.status === "completed").length,
  };

  return (
    <div className="stack-6">
      <div className="reveal" data-d="0">
        <div className="h-eyebrow" style={{ marginBottom: 4 }}>Jobs</div>
        <h1 className="h-display h-1" style={{ margin: 0 }}>Matched briefs</h1>
        <p className="muted" style={{ marginTop: 6 }}>Briefs you've been matched with. Initiating a negotiation locks the brief to you.</p>
      </div>

      <div className="row between reveal" data-d="1" style={{ flexWrap: "wrap", gap: 8 }}>
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: "all",       label: "All",        count: counts.all },
            { value: "matching",  label: "New matches", count: counts.matching },
            { value: "active",    label: "Active",     count: counts.active },
            { value: "completed", label: "Completed",  count: counts.completed },
          ]}
        />
        <div className="row" style={{ gap: 8 }}>
          <button className="btn ghost sm"><Icon name="filter" /> Filter</button>
        </div>
      </div>

      <div className="stack" style={{ gap: 10 }}>
        {filtered.map((j, i) => (
          <button key={j.id} className="job-card reveal" data-d={2 + i} onClick={() => onNav("job-detail", j.id)} style={{ padding: 16, position: "relative" }}>
            <div className="row between">
              <div className="row" style={{ gap: 8 }}>
                <span className="badge neutral">{j.category}</span>
                <StatusChip status={j.status} />
                {j.new_match && (
                  <span className="badge mint" style={{ fontSize: 10 }}>
                    <span className="bdot"></span> New
                  </span>
                )}
              </div>
              <div className="row" style={{ gap: 8, fontSize: 12, color: "var(--ink-500)" }}>
                <span>Received {j.received}</span>
                <Icon name="chevronRight" size={14} />
              </div>
            </div>
            <div style={{ marginTop: 8, fontWeight: 600, fontSize: 15.5, color: "var(--ink-950)", letterSpacing: "-0.005em" }}>{j.title}</div>
            <div style={{ fontSize: 12.5, color: "var(--ink-600)", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {j.description}
            </div>
            <div className="row" style={{ marginTop: 12, gap: 18, fontSize: 11.5, color: "var(--ink-500)", flexWrap: "wrap" }}>
              <span className="row" style={{ gap: 6 }}>
                <Avatar initials={j.client.initials} size="sm" />
                {j.client.business}
              </span>
              <span><Icon name="calendar" size={11} /> &nbsp;{j.deadline}</span>
              <span><Icon name="rupee" size={11} /> &nbsp;
                <span className="mono" style={{ color: "var(--ink-900)", fontWeight: 500 }}>{j.budget_range}</span>
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ===== Job detail (freelancer view) =====
function FreelancerJobDetail({ jobId, onNav, isMobile, pushToast }) {
  const baseJob = window.MM.FREELANCER_JOBS.find(j => j.id === jobId) || window.MM.FREELANCER_JOBS[0];
  const [job, setJob] = React.useState(baseJob);

  React.useEffect(() => {
    const fresh = window.MM.FREELANCER_JOBS.find(j => j.id === jobId) || window.MM.FREELANCER_JOBS[0];
    setJob(fresh);
  }, [jobId]);

  return (
    <div className="stack-6">
      <div className="reveal" data-d="0" style={{ marginBottom: -14 }}>
        <button className="btn link sm" onClick={() => onNav("jobs")} style={{ padding: 0, color: "var(--ink-500)", fontSize: 12 }}>
          <Icon name="arrowLeft" size={12} /> All briefs
        </button>
      </div>

      <div className="reveal" data-d="1">
        <div className="row" style={{ gap: 10, marginBottom: 10 }}>
          <span className="badge neutral">{job.category}</span>
          <StatusChip status={job.status} />
          <span className="muted" style={{ fontSize: 12 }}>Received {job.received}</span>
        </div>
        <h1 className="h-display" style={{ fontSize: isMobile ? 22 : 28, margin: 0, letterSpacing: "-0.02em", maxWidth: 760 }}>
          {job.title}
        </h1>
      </div>

      <JobTimeline status={job.status} />

      <div className={isMobile ? "stack" : ""} style={{ display: isMobile ? "flex" : "grid", gridTemplateColumns: isMobile ? undefined : "1fr 320px", gap: 18 }}>
        <div className="stack" style={{ gap: 18 }}>
          {job.status === "matching" && <FreelancerInitiatePanel job={job} setJob={setJob} pushToast={pushToast} />}
          {job.status === "negotiating" && <FreelancerNegotiationPanel job={job} setJob={setJob} pushToast={pushToast} />}
          {job.status === "in_progress" && <FreelancerInProgressPanel job={job} pushToast={pushToast} />}
          {job.status === "completed" && <FreelancerCompletedPanel job={job} />}

          <div className="card reveal" data-d="3">
            <h3 className="h-display h-3" style={{ margin: "0 0 10px" }}>The brief</h3>
            <p style={{ fontSize: 13.5, lineHeight: 1.65, color: "var(--ink-700)", margin: 0 }}>{job.description}</p>
            <div className="row wrap" style={{ marginTop: 14, gap: 6 }}>
              {job.required_skills.map(s => <span key={s} className="badge neutral">{s}</span>)}
            </div>
          </div>
        </div>

        <div className="stack" style={{ gap: 14 }}>
          <div className="card reveal" data-d="4" style={{ padding: 16 }}>
            <div className="h-eyebrow" style={{ marginBottom: 10 }}>Client</div>
            <div className="row" style={{ gap: 10 }}>
              <Avatar initials={job.client.initials} />
              <div>
                <div style={{ fontWeight: 500, fontSize: 13.5 }}>{job.client.name}</div>
                <div style={{ fontSize: 11.5, color: "var(--ink-500)" }}>{job.client.business}</div>
              </div>
            </div>
            <div className="divider"></div>
            <div className="stack" style={{ gap: 10, fontSize: 13 }}>
              <Row k="Budget"   v={<span className="mono" style={{ fontWeight: 500 }}>{job.budget_range}</span>} />
              <Row k="Deadline" v={job.deadline} />
              <Row k="Slots used" v={<span className="mono">{window.MM.FREELANCER.active_slots} / {window.MM.FREELANCER.max_slots}</span>} />
            </div>
          </div>

          {job.status === "in_progress" && (
            <div className="card-mint" style={{ padding: 14 }}>
              <div className="row between" style={{ marginBottom: 8 }}>
                <span className="h-eyebrow" style={{ color: "var(--mint-800)" }}>Escrow secured</span>
                <Icon name="lock" size={13} style={{ color: "var(--mint-700)" }} />
              </div>
              <div className="mono" style={{ fontSize: 22, fontWeight: 500 }}>{rupee(job.escrowed)}</div>
              <div style={{ fontSize: 12, color: "var(--ink-600)", marginTop: 6, lineHeight: 1.5 }}>
                Released on client approval. Your earnings are protected.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Freelancer — Initiate negotiation
function FreelancerInitiatePanel({ job, setJob, pushToast }) {
  const [showForm, setShowForm] = React.useState(false);
  const [confirm, setConfirm] = React.useState(false);
  const [price, setPrice] = React.useState(22000);
  const [days, setDays] = React.useState(9);
  const [msg, setMsg] = React.useState("");

  function send() {
    window.MM.FREELANCER_JOBS = window.MM.FREELANCER_JOBS.map(j => j.id === job.id ? {
      ...j, status: "negotiating", rounds: [{ who: "me", price, days, message: msg || `My standard for this scope is ₹${price.toLocaleString("en-IN")}, delivered in ${days} days.` }], current_round: 2, max_rounds: 5,
    } : j);
    setJob({ ...job, status: "negotiating", rounds: [{ who: "me", price, days, message: msg || `My standard for this scope is ₹${price.toLocaleString("en-IN")}, delivered in ${days} days.` }] });
    pushToast({ title: "Offer sent", body: `Brief is now locked to you. Priya has 24h to respond.` });
  }

  return (
    <>
      {confirm && (
        <Modal title="Lock this brief to you?" subtitle="Once you initiate, no other creative can negotiate this brief." onClose={() => setConfirm(false)}
          footer={
            <>
              <button className="btn ghost" onClick={() => setConfirm(false)}>Cancel</button>
              <button className="btn primary" onClick={() => { setConfirm(false); setShowForm(true); }}>
                Yes, lock it <Icon name="lock" />
              </button>
            </>
          }
        >
          <div style={{ padding: 12, background: "var(--amber-bg)", borderRadius: "var(--radius-md)", border: "1px solid oklch(0.85 0.13 75)", display: "flex", gap: 10 }}>
            <div style={{ flexShrink: 0, color: "var(--amber)" }}><Icon name="shield" /></div>
            <div style={{ fontSize: 12.5, color: "var(--ink-800)", lineHeight: 1.5 }}>
              You'll have <strong>5 rounds</strong> to agree with the client. After that the brief goes back to matching.
              This will use <strong>1 of your {window.MM.FREELANCER.max_slots} active slots</strong> ({window.MM.FREELANCER.active_slots} in use now).
            </div>
          </div>
        </Modal>
      )}

      {showForm ? (
        <div className="card reveal" data-d="3" style={{ padding: 22 }}>
          <div className="h-eyebrow" style={{ marginBottom: 6 }}>Your initial offer · Round 1</div>
          <h3 className="h-display h-3" style={{ margin: "0 0 14px" }}>Propose your terms</h3>
          <div className="grid-2" style={{ marginBottom: 12 }}>
            <div className="field">
              <label className="field-label">Your price</label>
              <div className="input-with-prefix">
                <span className="prefix">₹</span>
                <input className="input input-mono" type="number" value={price} onChange={e => setPrice(parseInt(e.target.value || 0))} />
              </div>
              <div className="field-hint">Client budget: {job.budget_range}</div>
            </div>
            <div className="field">
              <label className="field-label">Delivery (days)</label>
              <input className="input input-mono" type="number" value={days} onChange={e => setDays(parseInt(e.target.value || 0))} />
              <div className="field-hint">Deadline: {job.deadline}</div>
            </div>
          </div>
          <div className="field">
            <label className="field-label">Note to client</label>
            <textarea className="textarea" rows={3} placeholder="Why you're the right fit, what's included, any clarifying questions…" value={msg} onChange={e => setMsg(e.target.value)} />
          </div>
          <div className="row between" style={{ marginTop: 14 }}>
            <button className="btn ghost" onClick={() => setShowForm(false)}>Back</button>
            <button className="btn primary" onClick={send}>
              <Icon name="send" /> Send offer
            </button>
          </div>
        </div>
      ) : (
        <div className="card reveal" data-d="3" style={{ padding: 22 }}>
          <div className="h-eyebrow" style={{ marginBottom: 6, color: "var(--mint-700)" }}>Matched · open for offers</div>
          <h3 className="h-display h-2" style={{ margin: "0 0 6px" }}>Ready to take this on?</h3>
          <p style={{ fontSize: 13, color: "var(--ink-600)", margin: "0 0 16px", maxWidth: 480 }}>
            Initiating negotiation locks the brief to you for up to 5 back-and-forth rounds. No other creative can offer in the meantime.
          </p>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn primary" onClick={() => setConfirm(true)}>
              Initiate negotiation <Icon name="arrowRight" />
            </button>
            <button className="btn ghost">Save for later</button>
            <button className="btn link" style={{ color: "var(--ink-500)", marginLeft: "auto" }}>
              <Icon name="x" size={12} /> Pass
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// Freelancer — Negotiation
function FreelancerNegotiationPanel({ job, setJob, pushToast }) {
  const [rounds, setRounds] = React.useState(job.rounds || []);
  const [showCounter, setShowCounter] = React.useState(false);
  const [price, setPrice] = React.useState(20500);
  const [days, setDays] = React.useState(9);
  const [msg, setMsg] = React.useState("");
  const lastClient = [...rounds].reverse().find(r => r.who === "them");

  function counter() {
    setRounds(r => [...r, { who: "me", price, days, message: msg || `Can do ₹${price.toLocaleString("en-IN")} in ${days} days — works for both?` }]);
    setShowCounter(false);
    setMsg("");
    pushToast({ title: "Counter sent", body: "Client has 24h to respond." });
  }

  function accept() {
    pushToast({ title: "Deal accepted", body: `Awaiting admin approval · ₹${lastClient.price.toLocaleString("en-IN")}` });
    window.MM.FREELANCER_JOBS = window.MM.FREELANCER_JOBS.map(j => j.id === job.id ? { ...j, status: "in_progress", escrowed: lastClient.price, progress: 0 } : j);
    setTimeout(() => setJob({ ...job, status: "in_progress", escrowed: lastClient.price, progress: 0 }), 1200);
  }

  return (
    <div className="card reveal" data-d="3" style={{ padding: 20 }}>
      <div className="row between" style={{ marginBottom: 16 }}>
        <div>
          <span className="h-eyebrow">Your move</span>
          <h3 className="h-display h-3" style={{ margin: "2px 0 0" }}>Client countered at {rupee(lastClient?.price)}</h3>
        </div>
        <div className="row" style={{ gap: 6 }}>
          {[1, 2, 3, 4, 5].map(r => (
            <div key={r} className={`nego-round ${r <= rounds.length ? "done" : r === rounds.length + 1 ? "current" : ""}`}>{r}</div>
          ))}
        </div>
      </div>

      <div className="nego-board">
        {rounds.map((r, i) => (
          <div key={i} className={`offer-card ${r.who}`}>
            <div className="who-row">
              {r.who === "me" ? (
                <>
                  <Avatar initials={window.MM.FREELANCER.initials} size="sm" />
                  <span className="who-name">You</span>
                  <span className="muted">· proposed</span>
                </>
              ) : (
                <>
                  <Avatar initials={job.client.initials} size="sm" />
                  <span className="who-name">{job.client.name}</span>
                  <span className="muted">· countered</span>
                </>
              )}
              <span style={{ marginLeft: "auto", fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--ink-500)" }}>Round {i + 1}</span>
            </div>
            <div className="offer-row">
              <span className="big">{rupee(r.price)}</span>
              <span className="small">delivered in {r.days} days</span>
            </div>
            <div className="msg">{r.message}</div>
          </div>
        ))}
      </div>

      {!showCounter && (
        <div className="row" style={{ marginTop: 16, gap: 8, justifyContent: "flex-end" }}>
          <button className="btn ghost" onClick={() => setShowCounter(true)}><Icon name="refresh" /> Counter</button>
          <button className="btn mint" onClick={accept}><Icon name="check" /> Accept {rupee(lastClient?.price)}</button>
        </div>
      )}

      {showCounter && (
        <div style={{ marginTop: 16, padding: 14, background: "white", border: "1px solid var(--hairline)", borderRadius: "var(--radius-md)" }}>
          <div className="h-eyebrow" style={{ marginBottom: 10 }}>Counter offer · Round {rounds.length + 1}</div>
          <div className="grid-2" style={{ marginBottom: 10 }}>
            <div className="field">
              <label className="field-label">Your price</label>
              <div className="input-with-prefix">
                <span className="prefix">₹</span>
                <input className="input input-mono" type="number" value={price} onChange={e => setPrice(parseInt(e.target.value || 0))} />
              </div>
            </div>
            <div className="field">
              <label className="field-label">Delivery (days)</label>
              <input className="input input-mono" type="number" value={days} onChange={e => setDays(parseInt(e.target.value || 0))} />
            </div>
          </div>
          <div className="field">
            <label className="field-label">Message (optional)</label>
            <textarea className="textarea" rows={2} value={msg} onChange={e => setMsg(e.target.value)} placeholder="Add a note for the client…" />
          </div>
          <div className="row between" style={{ marginTop: 10 }}>
            <button className="btn ghost" onClick={() => setShowCounter(false)}>Cancel</button>
            <button className="btn primary" onClick={counter}><Icon name="send" /> Send counter</button>
          </div>
        </div>
      )}
    </div>
  );
}

// Freelancer — In progress (assignment accept + chat)
function FreelancerInProgressPanel({ job, pushToast }) {
  const [accepted, setAccepted] = React.useState(true);
  const [progress, setProgress] = React.useState(job.progress || 50);

  if (!accepted) {
    return (
      <div className="card reveal" data-d="3" style={{ padding: 22 }}>
        <div className="h-eyebrow" style={{ marginBottom: 6, color: "var(--mint-700)" }}>Deal approved by admin</div>
        <h3 className="h-display h-2" style={{ margin: "0 0 6px" }}>Ready to start?</h3>
        <p style={{ fontSize: 13, color: "var(--ink-600)", margin: "0 0 14px" }}>
          ₹{job.escrowed?.toLocaleString("en-IN") || "—"} has been escrowed. Accept to begin work.
        </p>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn mint" onClick={() => setAccepted(true)}><Icon name="check" /> Accept assignment</button>
          <button className="btn ghost">Decline</button>
        </div>
      </div>
    );
  }

  return (
    <div className="card reveal" data-d="3" style={{ padding: 20 }}>
      <div className="row between" style={{ marginBottom: 12 }}>
        <h3 className="h-display h-3" style={{ margin: 0 }}>Delivery progress</h3>
        <span className="mono" style={{ fontSize: 13, fontWeight: 500 }}>{progress}%</span>
      </div>
      <div style={{ height: 6, background: "var(--paper-deep)", borderRadius: 999, overflow: "hidden", marginBottom: 16 }}>
        <div style={{ width: `${progress}%`, height: "100%", background: "var(--mint-500)", borderRadius: 999, transition: "width 0.4s ease" }}></div>
      </div>

      <div className="stack" style={{ gap: 8 }}>
        {[
          { label: "Pre-prod call complete",   done: true },
          { label: "Concept &amp; storyboard approved", done: true },
          { label: "Rough cut delivered",      done: true },
          { label: "Final cut + color grade",  done: false },
          { label: "Client approval",          done: false },
        ].map((m, i) => (
          <div key={i} className="row" style={{ gap: 10, padding: "8px 10px", background: m.done ? "var(--mint-50)" : "var(--paper-tint)", borderRadius: 8, border: "1px solid var(--hairline)" }}>
            <Check on={m.done} onChange={() => {}} />
            <span style={{ fontSize: 13, color: m.done ? "var(--ink-950)" : "var(--ink-700)", flex: 1 }} dangerouslySetInnerHTML={{ __html: m.label }}></span>
            {m.done && <span style={{ fontSize: 11, color: "var(--ink-400)", fontFamily: "var(--font-mono)" }}>Oct {12 + i}</span>}
          </div>
        ))}
      </div>

      <div className="row" style={{ marginTop: 16, gap: 8 }}>
        <button className="btn primary" onClick={() => { setProgress(Math.min(100, progress + 15)); pushToast({ title: "Milestone updated", body: `Progress at ${Math.min(100, progress + 15)}%` }); }}>
          <Icon name="upload" /> Submit milestone
        </button>
        <button className="btn ghost"><Icon name="chat" /> Open chat</button>
      </div>
    </div>
  );
}

function FreelancerCompletedPanel({ job }) {
  return (
    <div className="card reveal" data-d="3" style={{ padding: 22 }}>
      <div className="row" style={{ gap: 12, marginBottom: 14 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--mint-100)", color: "var(--mint-700)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name="check" size={16} strokeWidth={2.4} />
        </div>
        <div>
          <div className="h-eyebrow" style={{ color: "var(--mint-700)" }}>Delivered &amp; paid</div>
          <h3 className="h-display h-3" style={{ margin: "2px 0 0" }}>{job.client.name.split(" ")[0]} rated you 5 stars</h3>
        </div>
      </div>
      <div className="row" style={{ gap: 8, color: "var(--amber)" }}>
        {[1, 2, 3, 4, 5].map(s => <Icon key={s} name="star" size={16} strokeWidth={2} />)}
      </div>
      <p style={{ fontSize: 13, color: "var(--ink-700)", marginTop: 10, lineHeight: 1.6, fontStyle: "italic" }}>
        “Arjun got our café's energy instantly. Cut was on point, music choices were chef's kiss, and turnaround was faster than promised.”
      </p>
    </div>
  );
}

// ===== Inquiries page =====
function FreelancerInquiries({ onNav, isMobile }) {
  const [open, setOpen] = React.useState(null);
  return (
    <div className="stack-6">
      <div className="reveal" data-d="0">
        <div className="h-eyebrow" style={{ marginBottom: 4 }}>Inquiries</div>
        <h1 className="h-display h-1" style={{ margin: 0 }}>Direct inquiries</h1>
        <p className="muted" style={{ marginTop: 6 }}>Clients who reached out via the marketplace, not through matching.</p>
      </div>

      <div className="stack" style={{ gap: 10 }}>
        {window.MM.FREELANCER_INQUIRIES.map((iq, i) => (
          <div key={iq.id} className="card reveal" data-d={1 + i} style={{ padding: 18 }}>
            <div className="row between" style={{ marginBottom: 12 }}>
              <div className="row" style={{ gap: 12 }}>
                <Avatar initials={iq.client.initials} size="lg" />
                <div>
                  <div style={{ fontWeight: 500, fontSize: 14 }}>{iq.client.name}</div>
                  <div style={{ fontSize: 12, color: "var(--ink-500)" }}>{iq.client.business} · received {iq.received}</div>
                </div>
              </div>
              <div className="row" style={{ gap: 8 }}>
                <span className="badge mint">{iq.package} package</span>
                <span className="badge neutral">New</span>
              </div>
            </div>
            <p style={{ fontSize: 13.5, color: "var(--ink-700)", lineHeight: 1.6, margin: "0 0 14px" }}>{iq.message}</p>
            <div className="row" style={{ gap: 20, fontSize: 12.5, color: "var(--ink-600)", marginBottom: 14 }}>
              <span><Icon name="rupee" size={12} /> &nbsp;Budget &nbsp;<span className="mono" style={{ color: "var(--ink-950)", fontWeight: 500 }}>{rupee(iq.budget)}</span></span>
              <span><Icon name="calendar" size={12} /> &nbsp;Deadline &nbsp;<span className="mono">{iq.deadline_days} days</span></span>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn mint" onClick={() => setOpen(iq)}><Icon name="check" /> Accept &amp; respond</button>
              <button className="btn ghost">Decline politely</button>
              <button className="btn link sm" style={{ marginLeft: "auto" }}>View client profile</button>
            </div>
          </div>
        ))}
      </div>

      {open && (
        <Modal title={`Respond to ${open.client.name}`} subtitle={`${open.package} package · ₹${open.budget.toLocaleString("en-IN")}`} onClose={() => setOpen(null)}
          footer={
            <>
              <button className="btn ghost" onClick={() => setOpen(null)}>Cancel</button>
              <button className="btn primary" onClick={() => { setOpen(null); }}><Icon name="send" /> Send response</button>
            </>
          }
        >
          <div className="field" style={{ marginBottom: 10 }}>
            <label className="field-label">Your response</label>
            <textarea className="textarea" rows={6} defaultValue={`Hi ${open.client.name.split(" ")[0]} — thanks for reaching out. Yes, I can take this on. A few quick clarifications before I lock in scope…`} />
          </div>
        </Modal>
      )}
    </div>
  );
}

Object.assign(window, {
  FreelancerDashboard, FreelancerJobsList, FreelancerJobDetail, FreelancerInquiries
});
