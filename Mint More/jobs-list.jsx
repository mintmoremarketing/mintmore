// Jobs — list, post-job multi-step, detail with all status states.

// ===== Jobs list =====

function JobsList({ onNav, isMobile }) {
  const [tab, setTab] = React.useState("all");
  const filtered = window.MM.JOBS.filter(j => {
    if (tab === "all") return true;
    if (tab === "active") return ["matching", "negotiating", "in_progress"].includes(j.status);
    return j.status === tab;
  });

  const counts = {
    all: window.MM.JOBS.length,
    active: window.MM.JOBS.filter(j => ["matching", "negotiating", "in_progress"].includes(j.status)).length,
    draft: window.MM.JOBS.filter(j => j.status === "draft").length,
    completed: window.MM.JOBS.filter(j => j.status === "completed").length,
  };

  return (
    <div className="stack-6">
      <div className="row between reveal" data-d="0">
        <div>
          <div className="h-eyebrow" style={{ marginBottom: 4 }}>Jobs</div>
          <h1 className="h-display h-1" style={{ margin: 0 }}>Briefs &amp; campaigns</h1>
        </div>
        <button className="btn primary" onClick={() => onNav("post-job")}>
          <Icon name="plus" /> Post a new brief
        </button>
      </div>

      <div className="row between reveal" data-d="1" style={{ flexWrap: "wrap", gap: 8 }}>
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: "all",       label: "All",          count: counts.all },
            { value: "active",    label: "Active",       count: counts.active },
            { value: "draft",     label: "Drafts",       count: counts.draft },
            { value: "completed", label: "Completed",    count: counts.completed },
          ]}
        />
        <div className="row" style={{ gap: 8 }}>
          <button className="btn ghost sm"><Icon name="filter" /> Filter</button>
          <button className="btn ghost sm"><Icon name="search" /> Search</button>
        </div>
      </div>

      <div className="stack" style={{ gap: 10 }}>
        {filtered.length === 0 ? (
          <div className="empty reveal" data-d="2">
            <div className="empty-glyph"><Icon name="briefcase" size={22} /></div>
            <h3>Nothing here yet</h3>
            <p>Post your first brief and we'll start matching creatives within minutes.</p>
            <button className="btn primary" onClick={() => onNav("post-job")}><Icon name="plus" /> Post a brief</button>
          </div>
        ) : (
          filtered.map((j, i) => (
            <button key={j.id} className="job-card reveal" data-d={2 + i} onClick={() => onNav("job-detail", j.id)} style={{ padding: 16 }}>
              <div className="row between">
                <div className="row" style={{ gap: 10 }}>
                  <span className="badge neutral">{j.category}</span>
                  <StatusChip status={j.status} />
                </div>
                <div className="row" style={{ gap: 16, fontSize: 12, color: "var(--ink-500)" }}>
                  <span>Created {j.created}</span>
                  <Icon name="chevronRight" size={14} />
                </div>
              </div>
              <div style={{ marginTop: 8, fontWeight: 600, fontSize: 15.5, color: "var(--ink-950)", letterSpacing: "-0.005em" }}>
                {j.title}
              </div>
              <div style={{ fontSize: 12.5, color: "var(--ink-600)", marginTop: 4, maxWidth: 720, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {j.description}
              </div>
              <div className="row" style={{ marginTop: 12, gap: 18, fontSize: 11.5, color: "var(--ink-500)", flexWrap: "wrap" }}>
                <span><Icon name="calendar" size={11} /> &nbsp;Deadline {j.deadline}</span>
                <span><Icon name="rupee" size={11} /> &nbsp;
                  <span className="mono" style={{ color: "var(--ink-900)", fontWeight: 500 }}>
                    {j.pricing_mode === "budget" ? rupee(j.budget) : `~${rupee(j.budget)}`}
                  </span>
                </span>
                {j.matched_freelancer && (
                  <span className="row" style={{ gap: 6 }}>
                    <Avatar initials={j.matched_freelancer.initials} size="sm" />
                    <span>{j.matched_freelancer.name}</span>
                  </span>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// ===== Post Job — multi-step =====

function PostJob({ onNav, onSubmit, isMobile }) {
  const [step, setStep] = React.useState(1);
  const [data, setData] = React.useState({
    title: "Brand film for Diwali drop — Tilak Weaves",
    category: "Videography",
    description: "60-90 second hero film for our handloom Diwali collection. Should capture the weaving process in Varanasi, finished sarees on real customers, and feel emotional rather than performative.",
    pricing_mode: "expert",
    budget: 35000,
    deadline: "Nov 02, 2026",
    skills: ["Cinematic video", "Storytelling", "Color grading"],
    level: "experienced",
  });

  function update(k, v) { setData(d => ({ ...d, [k]: v })); }

  return (
    <div className="stack-6">
      <div className="reveal" data-d="0" style={{ marginBottom: -10 }}>
        <button className="btn link sm" onClick={() => onNav("jobs")} style={{ padding: 0, color: "var(--ink-500)", fontSize: 12 }}>
          <Icon name="arrowLeft" size={12} /> All jobs
        </button>
        <h1 className="h-display h-1" style={{ margin: "6px 0 0" }}>Post a brief</h1>
        <p className="muted" style={{ marginTop: 6 }}>We'll match you with 2–4 creatives in around 6 minutes.</p>
      </div>

      <div className="stepper reveal" data-d="1">
        <div className={`step ${step >= 1 ? "active" : ""} ${step > 1 ? "done" : ""}`}>
          <span className="step-num">{step > 1 ? <Icon name="check" size={11} strokeWidth={3} /> : "1"}</span>
          <span>Basics</span>
        </div>
        <div className={`step-line ${step > 1 ? "done" : ""}`} style={{ background: step > 1 ? "var(--ink-950)" : "var(--hairline)" }}></div>
        <div className={`step ${step >= 2 ? "active" : ""} ${step > 2 ? "done" : ""}`}>
          <span className="step-num">{step > 2 ? <Icon name="check" size={11} strokeWidth={3} /> : "2"}</span>
          <span>Requirements</span>
        </div>
        <div className={`step-line ${step > 2 ? "done" : ""}`} style={{ background: step > 2 ? "var(--ink-950)" : "var(--hairline)" }}></div>
        <div className={`step ${step >= 3 ? "active" : ""}`}>
          <span className="step-num">3</span>
          <span>Review</span>
        </div>
      </div>

      <div className="card reveal" data-d="2" style={{ padding: isMobile ? 18 : 28 }}>
        {step === 1 && <PostStep1 data={data} update={update} />}
        {step === 2 && <PostStep2 data={data} update={update} />}
        {step === 3 && <PostStep3 data={data} />}
      </div>

      <div className="row between reveal" data-d="3">
        <button className="btn ghost" onClick={() => step > 1 ? setStep(step - 1) : onNav("jobs")}>
          <Icon name="arrowLeft" /> {step > 1 ? "Back" : "Cancel"}
        </button>
        <div className="row" style={{ gap: 8 }}>
          {step === 3 && <button className="btn ghost">Save as draft</button>}
          <button className="btn primary" onClick={() => step < 3 ? setStep(step + 1) : onSubmit(data)}>
            {step < 3 ? "Continue" : "Post brief"} <Icon name="arrowRight" />
          </button>
        </div>
      </div>
    </div>
  );
}

function PostStep1({ data, update }) {
  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="field">
        <label className="field-label">Brief title</label>
        <input className="input" value={data.title} onChange={e => update("title", e.target.value)} />
        <div className="field-hint">Keep it specific — “Diwali campaign hero video” works better than “Need a video”.</div>
      </div>

      <div className="grid-2">
        <div className="field">
          <label className="field-label">Category</label>
          <select className="select" value={data.category} onChange={e => update("category", e.target.value)}>
            {window.MM.CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="field-label">Channel</label>
          <select className="select" defaultValue="Web app">
            <option>Web app</option>
            <option>WhatsApp</option>
          </select>
        </div>
      </div>

      <div className="field">
        <label className="field-label">Brief description</label>
        <textarea className="textarea" value={data.description} onChange={e => update("description", e.target.value)} rows={6} />
        <div className="field-hint">Tone, references, audience, do's and don'ts — be specific.</div>
      </div>

      <div className="field">
        <label className="field-label">Attachments</label>
        <div style={{
          border: "1.5px dashed var(--hairline-strong)",
          borderRadius: "var(--radius-md)",
          padding: 18,
          textAlign: "center",
          background: "var(--paper-tint)",
        }}>
          <Icon name="upload" size={18} className="muted" />
          <div style={{ fontSize: 13, color: "var(--ink-700)", marginTop: 6 }}>
            Drag &amp; drop files, or <span style={{ color: "var(--ink-950)", textDecoration: "underline" }}>browse</span>
          </div>
          <div className="field-hint">PDF, JPG, MP4 · up to 100MB</div>
        </div>
        <div className="row wrap" style={{ marginTop: 10, gap: 6 }}>
          <span className="file-chip"><Icon name="paperclip" /> brief_v2.pdf <span className="muted">· 1.2 MB</span></span>
          <span className="file-chip"><Icon name="paperclip" /> moodboard.zip <span className="muted">· 18 MB</span></span>
        </div>
      </div>
    </div>
  );
}

function PostStep2({ data, update }) {
  return (
    <div className="stack" style={{ gap: 22 }}>
      <div>
        <label className="field-label" style={{ marginBottom: 8, display: "block" }}>Pricing</label>
        <div className="grid-2" style={{ gap: 10 }}>
          <button
            className={`role-card ${data.pricing_mode === "budget" ? "on" : ""}`}
            onClick={() => update("pricing_mode", "budget")}
          >
            <Icon name="rupee" />
            <span className="role-title">I have a budget</span>
            <span className="role-sub">Set a price; creatives can accept or counter.</span>
          </button>
          <button
            className={`role-card ${data.pricing_mode === "expert" ? "on" : ""}`}
            onClick={() => update("pricing_mode", "expert")}
          >
            <Icon name="sparkles" />
            <span className="role-title">Let them quote</span>
            <span className="role-sub">Expert pricing — best for complex briefs.</span>
          </button>
        </div>
      </div>

      <div className="field">
        <div className="row between">
          <label className="field-label">
            {data.pricing_mode === "budget" ? "Your budget" : "Reference budget"}
          </label>
          <span className="mono" style={{ fontSize: 14, fontWeight: 500, color: "var(--ink-950)" }}>
            {rupee(data.budget)}
          </span>
        </div>
        <input
          className="slider"
          type="range"
          min="5000"
          max="100000"
          step="500"
          value={data.budget}
          onChange={e => update("budget", parseInt(e.target.value))}
        />
        <div className="row between muted" style={{ fontSize: 11, fontFamily: "var(--font-mono)" }}>
          <span>₹5,000</span>
          <span>₹1,00,000</span>
        </div>
      </div>

      <div className="grid-2">
        <div className="field">
          <label className="field-label">Deadline</label>
          <input className="input" type="text" value={data.deadline} onChange={e => update("deadline", e.target.value)} />
        </div>
        <div className="field">
          <label className="field-label">Experience level</label>
          <select className="select" value={data.level} onChange={e => update("level", e.target.value)}>
            <option value="beginner">Beginner — small budget, fast</option>
            <option value="intermediate">Intermediate — solid track record</option>
            <option value="experienced">Experienced — agency-quality</option>
          </select>
        </div>
      </div>

      <div className="field">
        <label className="field-label">Required skills</label>
        <div className="row wrap" style={{ gap: 6 }}>
          {data.skills.map(s => (
            <span key={s} className="badge neutral" style={{ padding: "5px 10px", fontSize: 12 }}>
              {s}
              <button style={{ background: "transparent", border: 0, padding: 0, color: "var(--ink-500)", marginLeft: 4 }}>
                <Icon name="x" size={10} />
              </button>
            </span>
          ))}
          <input className="input" placeholder="Add skill…" style={{ width: 140, padding: "5px 10px", fontSize: 12 }} />
        </div>
      </div>
    </div>
  );
}

function PostStep3({ data }) {
  return (
    <div className="stack" style={{ gap: 18 }}>
      <div>
        <span className="h-eyebrow" style={{ color: "var(--mint-700)" }}>Ready to post</span>
        <h2 className="h-display h-2" style={{ margin: "6px 0 8px" }}>{data.title}</h2>
        <div className="row" style={{ gap: 8 }}>
          <span className="badge neutral">{data.category}</span>
          <span className="badge neutral">{data.level}</span>
          <span className="badge mint"><span className="bdot"></span> {data.pricing_mode === "budget" ? "Fixed budget" : "Open to quotes"}</span>
        </div>
      </div>

      <div className="divider"></div>

      <div className="grid-2" style={{ gap: 18 }}>
        <div>
          <div className="h-eyebrow" style={{ marginBottom: 6 }}>Brief</div>
          <p style={{ fontSize: 13, lineHeight: 1.55, color: "var(--ink-700)", margin: 0 }}>{data.description}</p>
        </div>
        <div>
          <div className="h-eyebrow" style={{ marginBottom: 6 }}>At a glance</div>
          <div className="stack" style={{ gap: 8, fontSize: 13 }}>
            <div className="row between"><span className="muted">Budget</span><span className="mono">{rupee(data.budget)}</span></div>
            <div className="row between"><span className="muted">Deadline</span><span>{data.deadline}</span></div>
            <div className="row between"><span className="muted">Attachments</span><span>2 files</span></div>
            <div className="row between"><span className="muted">Skills</span><span>{data.skills.length} tags</span></div>
          </div>
        </div>
      </div>

      <div className="card-tint" style={{ padding: 14 }}>
        <div className="row" style={{ gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--mint-100)", color: "var(--mint-700)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name="radar" size={14} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-950)" }}>
              Estimated matching time: ~6 minutes
            </div>
            <div style={{ fontSize: 12, color: "var(--ink-500)", marginTop: 2 }}>
              We'll notify you when 2–4 creatives are short-listed. Nothing is locked until you start a negotiation.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { JobsList, PostJob });
