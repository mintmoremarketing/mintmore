// Job detail — branches on status: matching radar / negotiation / in-progress chat / completed

function JobDetail({ jobId, onNav, isMobile, pushToast }) {
  const baseJob = window.MM.JOBS.find(j => j.id === jobId) || window.MM.JOBS[0];
  const [job, setJob] = React.useState(baseJob);

  // Re-load when jobId prop changes
  React.useEffect(() => {
    const fresh = window.MM.JOBS.find(j => j.id === jobId) || window.MM.JOBS[0];
    setJob(fresh);
  }, [jobId]);

  const meta = window.MM.STATUS_META[job.status];

  return (
    <div className="stack-6">
      {/* Breadcrumb */}
      <div className="reveal" data-d="0" style={{ marginBottom: -14 }}>
        <button className="btn link sm" onClick={() => onNav("jobs")} style={{ padding: 0, color: "var(--ink-500)", fontSize: 12 }}>
          <Icon name="arrowLeft" size={12} /> All jobs
        </button>
      </div>

      {/* Header */}
      <div className="reveal" data-d="1">
        <div className="row" style={{ gap: 10, marginBottom: 10 }}>
          <span className="badge neutral">{job.category}</span>
          <StatusChip status={job.status} />
          <span className="muted" style={{ fontSize: 12 }}>Posted {job.created}</span>
        </div>
        <h1 className="h-display" style={{ fontSize: isMobile ? 22 : 28, margin: 0, letterSpacing: "-0.02em", maxWidth: 760 }}>
          {job.title}
        </h1>
      </div>

      {/* Status timeline */}
      <JobTimeline status={job.status} />

      <div className={isMobile ? "stack" : ""} style={{ display: isMobile ? "flex" : "grid", gridTemplateColumns: isMobile ? undefined : "1fr 320px", gap: 18 }}>
        {/* Main column */}
        <div className="stack" style={{ gap: 18 }}>
          {job.status === "draft" && <DraftPanel job={job} pushToast={pushToast} setJob={setJob} />}
          {job.status === "matching" && <MatchingPanel job={job} pushToast={pushToast} setJob={setJob} />}
          {job.status === "negotiating" && <NegotiationPanel job={job} pushToast={pushToast} setJob={setJob} />}
          {job.status === "in_progress" && <ChatPanel job={job} isMobile={isMobile} />}
          {job.status === "completed" && <CompletedPanel job={job} />}

          {/* Brief */}
          <div className="card reveal" data-d="3">
            <h3 className="h-display h-3" style={{ margin: "0 0 10px" }}>The brief</h3>
            <p style={{ fontSize: 13.5, lineHeight: 1.65, color: "var(--ink-700)", margin: 0 }}>{job.description}</p>
            {job.skills && (
              <div className="row wrap" style={{ marginTop: 14, gap: 6 }}>
                {job.skills.map(s => <span key={s} className="badge neutral">{s}</span>)}
              </div>
            )}
            {job.files && (
              <>
                <div className="divider"></div>
                <div className="h-eyebrow" style={{ marginBottom: 8 }}>Attachments</div>
                <div className="row wrap" style={{ gap: 6 }}>
                  {job.files.map(f => (
                    <span key={f} className="file-chip"><Icon name="paperclip" /> {f}</span>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right rail */}
        <div className="stack" style={{ gap: 14 }}>
          <div className="card reveal" data-d="4" style={{ padding: 16 }}>
            <div className="h-eyebrow" style={{ marginBottom: 10 }}>At a glance</div>
            <div className="stack" style={{ gap: 10, fontSize: 13 }}>
              <Row k="Status"   v={<StatusChip status={job.status} />} />
              <Row k="Budget"   v={<span className="mono" style={{ fontWeight: 500 }}>{job.pricing_mode === "budget" ? rupee(job.budget) : `~${rupee(job.budget)}`}</span>} />
              <Row k="Deadline" v={job.deadline} />
              <Row k="Level"    v={<span style={{ textTransform: "capitalize" }}>{job.level}</span>} />
              {job.matched_freelancer && (
                <>
                  <div className="divider" style={{ margin: "4px 0" }}></div>
                  <div className="row" style={{ gap: 10 }}>
                    <Avatar initials={job.matched_freelancer.initials} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, fontSize: 13, color: "var(--ink-950)" }}>{job.matched_freelancer.name}</div>
                      <div style={{ fontSize: 11.5, color: "var(--ink-500)" }}>{job.matched_freelancer.tagline}</div>
                      <div className="row" style={{ gap: 6, marginTop: 4, fontSize: 11.5 }}>
                        <span style={{ color: "var(--amber)" }}><Icon name="star" size={11} strokeWidth={2.4} /></span>
                        <span className="mono" style={{ fontWeight: 500 }}>{job.matched_freelancer.rating}</span>
                        <span className="muted">({job.matched_freelancer.reviews})</span>
                        <span className="badge mint sm" style={{ marginLeft: "auto", fontSize: 10 }}>{job.matched_freelancer.level}</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {job.status === "in_progress" && (
            <div className="card-mint reveal" data-d="5" style={{ padding: 14 }}>
              <div className="row between" style={{ marginBottom: 8 }}>
                <span className="h-eyebrow" style={{ color: "var(--mint-800)" }}>Escrow held</span>
                <Icon name="lock" size={13} style={{ color: "var(--mint-700)" }} />
              </div>
              <div className="mono" style={{ fontSize: 22, fontWeight: 500, color: "var(--ink-950)" }}>{rupee(job.escrowed || 45000)}</div>
              <div style={{ fontSize: 12, color: "var(--ink-600)", marginTop: 6, lineHeight: 1.5 }}>
                Released to {job.matched_freelancer?.name.split(" ")[0]} on delivery approval. Visible to admin for dispute.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }) {
  return (
    <div className="row between">
      <span className="muted" style={{ fontSize: 12 }}>{k}</span>
      <span style={{ fontSize: 13, color: "var(--ink-900)", textAlign: "right" }}>{v}</span>
    </div>
  );
}

function JobTimeline({ status }) {
  const stages = [
    { key: "draft", label: "Drafted" },
    { key: "matching", label: "Matching" },
    { key: "negotiating", label: "Negotiating" },
    { key: "in_progress", label: "In progress" },
    { key: "completed", label: "Completed" },
  ];
  const order = ["draft", "matching", "negotiating", "in_progress", "completed"];
  const cur = order.indexOf(status);

  return (
    <div className="card reveal" data-d="2" style={{ padding: "12px 18px" }}>
      <div className="row between" style={{ gap: 0 }}>
        {stages.map((s, i) => {
          const done = i < cur;
          const active = i === cur;
          return (
            <React.Fragment key={s.key}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <div style={{
                  width: 18, height: 18, borderRadius: "50%",
                  background: active ? "var(--mint-600)" : done ? "var(--ink-950)" : "var(--paper-tint)",
                  border: `1px solid ${active ? "var(--mint-600)" : done ? "var(--ink-950)" : "var(--hairline-strong)"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "white", flexShrink: 0,
                  boxShadow: active ? "0 0 0 4px var(--mint-100)" : "none",
                }}>
                  {done && <Icon name="check" size={10} strokeWidth={3} />}
                  {active && <div style={{ width: 5, height: 5, borderRadius: "50%", background: "white" }}></div>}
                </div>
                <span style={{
                  fontSize: 12,
                  fontWeight: active ? 500 : 400,
                  color: active ? "var(--ink-950)" : done ? "var(--ink-700)" : "var(--ink-400)",
                }}>{s.label}</span>
              </div>
              {i < stages.length - 1 && (
                <div style={{
                  flex: 1, height: 1, margin: "0 12px",
                  background: i < cur ? "var(--ink-950)" : "var(--hairline)",
                }}></div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

// ===== Draft =====
function DraftPanel({ job, pushToast, setJob }) {
  return (
    <div className="card reveal" data-d="3" style={{ padding: 22 }}>
      <div className="h-eyebrow" style={{ marginBottom: 8 }}>Draft</div>
      <h3 className="h-display h-2" style={{ margin: "0 0 6px" }}>Ready when you are</h3>
      <p style={{ fontSize: 13, color: "var(--ink-600)", margin: 0, maxWidth: 460 }}>
        This brief hasn't been posted yet. Once you publish it, we'll start matching creatives within minutes.
      </p>
      <div className="row" style={{ marginTop: 14, gap: 8 }}>
        <button className="btn primary" onClick={() => {
          window.MM.JOBS = window.MM.JOBS.map(j => j.id === job.id ? { ...j, status: "matching", matches_found: 0 } : j);
          setJob({ ...job, status: "matching", matches_found: 0 });
          pushToast({ title: "Brief posted", body: "We're matching creatives now." });
        }}>
          Post now <Icon name="arrowRight" />
        </button>
        <button className="btn ghost"><Icon name="edit" /> Edit draft</button>
        <button className="btn link" style={{ color: "var(--rose)", marginLeft: "auto" }}>Delete</button>
      </div>
    </div>
  );
}

// ===== Matching radar =====
function MatchingPanel({ job, pushToast, setJob }) {
  const [count, setCount] = React.useState(job.matches_found || 0);

  React.useEffect(() => {
    if (count >= 3) return;
    const t = setTimeout(() => setCount(c => c + 1), 2400);
    return () => clearTimeout(t);
  }, [count]);

  return (
    <div className="card reveal" data-d="3" style={{ padding: 26, textAlign: "center", position: "relative", overflow: "hidden" }}>
      <div className="h-eyebrow" style={{ marginBottom: 6 }}>Matching now</div>
      <h3 className="h-display h-2" style={{ margin: "0 0 6px" }}>
        Finding the right creative.
      </h3>
      <p className="muted" style={{ margin: "0 auto 22px", maxWidth: 380, fontSize: 13 }}>
        We're scanning 2,400+ verified videographers across India. Average match time is ~6 minutes.
      </p>

      <div className="radar-wrap">
        <div className="radar-pulse"></div>
        <div className="radar-pulse"></div>
        <div className="radar-pulse"></div>
        <div className="radar-pulse"></div>
        <div className="radar-blip"></div>
        <div className="radar-blip"></div>
        <div className="radar-blip"></div>
        <div className="radar-core">
          <Icon name="radar" size={22} strokeWidth={1.8} />
        </div>
      </div>

      <div style={{ marginTop: 22 }}>
        <div className="row" style={{ justifyContent: "center", gap: 8, fontSize: 13 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--mint-500)", boxShadow: "0 0 0 3px var(--mint-100)" }}></span>
          <span className="mono" style={{ fontWeight: 500, color: "var(--ink-950)" }}>{count}</span>
          <span className="muted">of 4 creatives short-listed</span>
        </div>
        <div className="muted" style={{ fontSize: 11, marginTop: 4, fontFamily: "var(--font-mono)" }}>~ 3 min remaining</div>
      </div>

      <div className="row" style={{ justifyContent: "center", marginTop: 22, gap: 8 }}>
        <button className="btn ghost sm">Pause matching</button>
        <button className="btn ghost sm"><Icon name="edit" /> Edit brief</button>
      </div>

      {/* Short-listed creatives appearing as they come */}
      <div style={{ marginTop: 26, paddingTop: 22, borderTop: "1px solid var(--hairline)", textAlign: "left" }}>
        <div className="h-eyebrow" style={{ marginBottom: 10 }}>Short-list ({count})</div>
        <div className="stack" style={{ gap: 8 }}>
          {[
            { name: "Arjun Mehta",  tag: "Brand films • Mumbai",     rating: 4.9, reviews: 142, fit: 96 },
            { name: "Kavya Iyer",   tag: "Cinematic stills + film • Bengaluru", rating: 4.95, reviews: 89, fit: 92 },
            { name: "Vikram Joshi", tag: "Documentary style • Delhi", rating: 4.8, reviews: 67, fit: 88 },
          ].slice(0, count).map((c, i) => (
            <div key={c.name} className="reveal" data-d="0" style={{ display: "flex", gap: 12, alignItems: "center", padding: "10px 12px", background: "var(--paper-tint)", borderRadius: "var(--radius-md)", border: "1px solid var(--hairline)" }}>
              <Avatar name={c.name} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--ink-950)" }}>{c.name}</div>
                <div style={{ fontSize: 11.5, color: "var(--ink-500)" }}>{c.tag}</div>
              </div>
              <div className="row" style={{ gap: 12 }}>
                <div style={{ textAlign: "right" }}>
                  <div className="mono" style={{ fontSize: 11, color: "var(--mint-700)", fontWeight: 600 }}>{c.fit}% fit</div>
                  <div style={{ fontSize: 11, color: "var(--ink-500)" }}>{c.rating} ★ ({c.reviews})</div>
                </div>
              </div>
            </div>
          ))}
          {count < 3 && (
            <div style={{ padding: "10px 12px", background: "var(--paper-tint)", borderRadius: "var(--radius-md)", border: "1px dashed var(--hairline-strong)", display: "flex", alignItems: "center", gap: 12 }}>
              <div className="skel" style={{ width: 30, height: 30, borderRadius: "50%" }}></div>
              <div style={{ flex: 1 }}>
                <div className="skel" style={{ height: 11, width: "55%", marginBottom: 6 }}></div>
                <div className="skel" style={{ height: 9, width: "35%" }}></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ===== Negotiation ping-pong =====
function NegotiationPanel({ job, pushToast, setJob }) {
  const [rounds, setRounds] = React.useState(job.rounds || []);
  const [showCounter, setShowCounter] = React.useState(false);
  const [counterPrice, setCounterPrice] = React.useState(20500);
  const [counterDays, setCounterDays] = React.useState(9);
  const [counterMsg, setCounterMsg] = React.useState("");
  const [waitingAdmin, setWaitingAdmin] = React.useState(false);
  const f = job.matched_freelancer;
  const lastTheirs = [...rounds].reverse().find(r => r.who === "them");
  const round = rounds.length + 1;

  function accept() {
    setWaitingAdmin(true);
    pushToast({ title: "Deal sent for admin approval", body: `₹${lastTheirs.price.toLocaleString("en-IN")} · ${lastTheirs.days} days` });
  }

  function sendCounter() {
    setRounds([...rounds, { who: "me", price: counterPrice, days: counterDays, message: counterMsg || `Can we land at ₹${counterPrice.toLocaleString("en-IN")}? ${counterDays}-day delivery works.` }]);
    setShowCounter(false);
    setCounterMsg("");
    pushToast({ title: "Counter offer sent", body: `Arjun has 24h to respond.` });
  }

  return (
    <div className="card reveal" data-d="3" style={{ padding: 20 }}>
      <div className="row between" style={{ marginBottom: 16 }}>
        <div>
          <span className="h-eyebrow">Negotiation</span>
          <h3 className="h-display h-3" style={{ margin: "2px 0 0" }}>Counter offer is on the table</h3>
        </div>
        <div className="row" style={{ gap: 6 }}>
          {[1, 2, 3, 4, 5].map(r => (
            <div key={r} className={`nego-round ${r < round ? "done" : r === round ? "current" : ""}`}>{r}</div>
          ))}
        </div>
      </div>

      {waitingAdmin && (
        <div className="card-mint" style={{ marginBottom: 14, padding: 14, animation: "slideIn 0.32s ease" }}>
          <div className="row" style={{ gap: 12 }}>
            <div style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--mint-200)", color: "var(--mint-800)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="shield" size={14} />
            </div>
            <div>
              <div style={{ fontWeight: 500, color: "var(--ink-950)" }}>Awaiting admin approval</div>
              <div style={{ fontSize: 12, color: "var(--ink-600)", marginTop: 2 }}>
                Once approved (~30 min), funds will be escrowed and Arjun will begin work.
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="nego-board">
        {rounds.map((r, i) => (
          <div key={i} className={`offer-card ${r.who}`}>
            <div className="who-row">
              {r.who === "them" ? (
                <>
                  <Avatar initials={f.initials} size="sm" />
                  <span className="who-name">{f.name}</span>
                  <span className="muted">· proposed</span>
                </>
              ) : (
                <>
                  <Avatar initials={window.MM.USER.initials} size="sm" />
                  <span className="who-name">You</span>
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

      {!waitingAdmin && !showCounter && (
        <div className="row" style={{ marginTop: 16, gap: 8, justifyContent: "flex-end" }}>
          <button className="btn ghost" onClick={() => setShowCounter(true)}>
            <Icon name="refresh" /> Counter offer
          </button>
          <button className="btn mint" onClick={accept}>
            <Icon name="check" /> Accept ₹{lastTheirs?.price.toLocaleString("en-IN")}
          </button>
        </div>
      )}

      {!waitingAdmin && showCounter && (
        <div style={{ marginTop: 16, padding: 14, background: "white", border: "1px solid var(--hairline)", borderRadius: "var(--radius-md)" }}>
          <div className="h-eyebrow" style={{ marginBottom: 10 }}>Your counter · Round {round}</div>
          <div className="grid-2" style={{ marginBottom: 10 }}>
            <div className="field">
              <label className="field-label">Your price</label>
              <div className="input-with-prefix">
                <span className="prefix">₹</span>
                <input className="input input-mono" type="number" value={counterPrice} onChange={e => setCounterPrice(parseInt(e.target.value || 0))} />
              </div>
            </div>
            <div className="field">
              <label className="field-label">Delivery (days)</label>
              <input className="input input-mono" type="number" value={counterDays} onChange={e => setCounterDays(parseInt(e.target.value || 0))} />
            </div>
          </div>
          <div className="field">
            <label className="field-label">Message (optional)</label>
            <textarea className="textarea" rows={2} placeholder="Add a note for Arjun…" value={counterMsg} onChange={e => setCounterMsg(e.target.value)} />
          </div>
          <div className="row" style={{ marginTop: 10, gap: 8, justifyContent: "flex-end" }}>
            <button className="btn ghost" onClick={() => setShowCounter(false)}>Cancel</button>
            <button className="btn primary" onClick={sendCounter}>
              <Icon name="send" /> Send counter
            </button>
          </div>
          <div className="muted" style={{ fontSize: 11, marginTop: 8, textAlign: "right" }}>
            <Icon name="shield" size={10} /> Max 5 rounds. Round resets weekly.
          </div>
        </div>
      )}
    </div>
  );
}

// ===== Chat panel for in-progress jobs =====
function ChatPanel({ job, isMobile }) {
  const [messages, setMessages] = React.useState(job.messages || []);
  const [draft, setDraft] = React.useState("");
  const [typing, setTyping] = React.useState(false);
  const scrollRef = React.useRef(null);

  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, typing]);

  function send() {
    if (!draft.trim()) return;
    setMessages(m => [...m, { who: "me", text: draft, time: nowTime() }]);
    setDraft("");
    setTimeout(() => setTyping(true), 600);
    setTimeout(() => {
      setTyping(false);
      setMessages(m => [...m, { who: "them", text: "On it! Will share an update shortly.", time: nowTime() }]);
    }, 2200);
  }

  return (
    <div className="card reveal" data-d="3" style={{ padding: 0, overflow: "hidden" }}>
      <div className="row between" style={{ padding: "12px 16px", borderBottom: "1px solid var(--hairline)" }}>
        <div className="row" style={{ gap: 10 }}>
          <Avatar initials={job.matched_freelancer.initials} />
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--ink-950)" }}>
              {job.matched_freelancer.name}
              <span className="badge mint" style={{ marginLeft: 8, fontSize: 10 }}>
                <span className="bdot"></span> Online
              </span>
            </div>
            <div style={{ fontSize: 11.5, color: "var(--ink-500)" }}>{job.matched_freelancer.tagline}</div>
          </div>
        </div>
        <span className="badge dark" style={{ background: "var(--ink-950)", color: "var(--mint-300)", fontFamily: "var(--font-mono)" }}>
          MM Web Chat
        </span>
      </div>

      <div className="chat-stream" ref={scrollRef} style={{ borderRadius: 0, border: "0", minHeight: 320, maxHeight: 380 }}>
        <div className="bubble-row system">
          <div className="bubble">Escrow of ₹45,000 locked. Conversation started Oct 15.</div>
        </div>
        {messages.map((m, i) => (
          <div key={i} className={`bubble-row ${m.who}`}>
            <div className="bubble">
              {m.who === "them" && <div className="who">{job.matched_freelancer.name.split(" ")[0]}</div>}
              {m.text}
              <span className="meta">{m.time} {m.who === "me" && <span style={{ color: "var(--mint-700)", marginLeft: 4 }}>✓✓</span>}</span>
            </div>
          </div>
        ))}
        {typing && (
          <div className="bubble-row them">
            <div className="bubble" style={{ padding: "10px 14px" }}>
              <span className="typing-dots">
                <span></span><span></span><span></span>
              </span>
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: 12, borderTop: "1px solid var(--hairline)", background: "white" }}>
        <div className="row" style={{ gap: 8 }}>
          <button className="icon-btn"><Icon name="paperclip" /></button>
          <input
            className="input"
            style={{ flex: 1, border: "0", background: "var(--paper-tint)" }}
            placeholder="Write a message…"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => e.key === "Enter" && send()}
          />
          <button className="btn mint" onClick={send} disabled={!draft.trim()}>
            <Icon name="send" />
          </button>
        </div>
      </div>
    </div>
  );
}

function nowTime() {
  const d = new Date();
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m} ${ap}`;
}

// ===== Completed =====
function CompletedPanel({ job }) {
  return (
    <div className="card reveal" data-d="3" style={{ padding: 22 }}>
      <div className="row" style={{ gap: 12, marginBottom: 14 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--mint-100)", color: "var(--mint-700)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name="check" size={16} strokeWidth={2.4} />
        </div>
        <div>
          <div className="h-eyebrow" style={{ color: "var(--mint-700)" }}>Delivered &amp; paid</div>
          <h3 className="h-display h-3" style={{ margin: "2px 0 0" }}>You rated this 5 stars · {job.matched_freelancer.name.split(" ")[0]} delivered on time</h3>
        </div>
      </div>
      <div className="row" style={{ gap: 8, color: "var(--amber)" }}>
        {[1, 2, 3, 4, 5].map(s => <Icon key={s} name="star" size={16} strokeWidth={2} />)}
      </div>
      <p style={{ fontSize: 13, color: "var(--ink-700)", marginTop: 10, lineHeight: 1.6, fontStyle: "italic" }}>
        “Rohan understood our heritage and translated it into a mark that still feels like Tilak Weaves. Three rounds, on time, lovely communication.”
      </p>
      <div className="row" style={{ marginTop: 14, gap: 8 }}>
        <button className="btn primary"><Icon name="refresh" /> Re-hire</button>
        <button className="btn ghost"><Icon name="download" /> Download deliverables</button>
      </div>
    </div>
  );
}

Object.assign(window, { JobDetail, Row, JobTimeline });
