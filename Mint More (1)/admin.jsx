// Phase 4 — Admin panel: Dashboard, Users, Negotiations approval, Wallet management

// ---------- Sparkline helper ----------
function Spark({ data, color = "var(--mint-600)", w = 120, h = 28, fill = true }) {
  const max = Math.max(...data), min = Math.min(...data);
  const range = max - min || 1;
  const step = w / (data.length - 1);
  const pts = data.map((v, i) => [i * step, h - ((v - min) / range) * (h - 2) - 1]);
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const area = `${line} L${w} ${h} L0 ${h} Z`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }}>
      {fill && <path d={area} fill={color} opacity="0.12" />}
      <path d={line} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// =========================================================
// Admin Dashboard
// =========================================================
function AdminDashboard({ onNav, isMobile }) {
  const k = window.MM.ADMIN_KPIS;
  const flagged = window.MM.ADMIN_ACTIVITY.filter(a => a.flag);
  const negos = window.MM.ADMIN_NEGOTIATIONS;

  return (
    <div className="stack-6">
      <div className="row between reveal" data-d="0" style={{ flexWrap: "wrap", gap: 12 }}>
        <div>
          <div className="h-eyebrow" style={{ marginBottom: 4 }}>Admin · {window.MM.ADMIN.name}</div>
          <h1 className="h-display h-1" style={{ margin: 0 }}>Platform overview</h1>
          <p className="muted" style={{ marginTop: 6 }}>October 15, 2026 · 11:48 AM IST · all systems green</p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <span className="badge mint"><span className="bdot"></span> 312 live jobs</span>
          <span className="badge amber"><span className="bdot"></span> {flagged.length} flags</span>
        </div>
      </div>

      {/* KPI tiles with sparklines */}
      <div className="grid-4" style={{ gap: 14 }}>
        {Object.entries(k).map(([key, v], i) => (
          <div key={key} className="stat-tile reveal" data-d={1 + i}>
            <div className="row between">
              <span className="label">{v.label}</span>
              <span className={`delta ${v.trend === "down" ? "down" : ""}`}>
                <Icon name="trending" size={11} strokeWidth={2.2} /> {v.delta}
              </span>
            </div>
            <div className="value mono">
              {typeof v.value === "number" && v.value >= 1_00_000
                ? rupee(v.value)
                : v.value.toLocaleString("en-IN")}
            </div>
            <Spark data={v.spark} w={isMobile ? 180 : 200} h={26} color="var(--mint-600)" />
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.5fr 1fr", gap: 16 }}>
        {/* Approval queue */}
        <div className="card reveal" data-d="5">
          <div className="row between" style={{ marginBottom: 12 }}>
            <div>
              <h3 className="h-display h-3" style={{ margin: 0 }}>Approval queue</h3>
              <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>Negotiations needing platform sign-off</div>
            </div>
            <button className="btn link sm" onClick={() => onNav("admin-negos")}>
              See all <Icon name="arrowRight" size={11} />
            </button>
          </div>
          <div className="stack" style={{ gap: 8 }}>
            {negos.slice(0, 3).map(n => (
              <button key={n.id} className="job-card" onClick={() => onNav("admin-negos")}
                style={{ padding: 14 }}>
                <div className="row between" style={{ marginBottom: 6 }}>
                  <div className="row" style={{ gap: 8 }}>
                    <Avatar initials={n.client.initials} size="sm" />
                    <span style={{ fontSize: 11, color: "var(--ink-500)" }}>↔</span>
                    <Avatar initials={n.freelancer.initials} size="sm" />
                  </div>
                  <span className="badge amber"><span className="bdot"></span> Round {n.rounds}/{n.max_rounds}</span>
                </div>
                <div style={{ fontWeight: 500, fontSize: 13.5, color: "var(--ink-950)", marginBottom: 4 }}>{n.job}</div>
                <div className="row between" style={{ fontSize: 12 }}>
                  <span className="muted">{n.flagged_reason.slice(0, 60)}…</span>
                  <span className="mono" style={{ fontWeight: 600, color: "var(--ink-950)" }}>{rupee(n.final_price)}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Activity feed */}
        <div className="card reveal" data-d="6">
          <div className="row between" style={{ marginBottom: 12 }}>
            <h3 className="h-display h-3" style={{ margin: 0 }}>Live activity</h3>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--mint-700)", display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--mint-500)", boxShadow: "0 0 0 2px var(--mint-100)" }}></span>
              Streaming
            </span>
          </div>
          <div className="stack" style={{ gap: 0 }}>
            {window.MM.ADMIN_ACTIVITY.slice(0, 7).map((a, i) => (
              <div key={a.id} style={{
                display: "flex", gap: 10, padding: "10px 0",
                borderTop: i === 0 ? "0" : "1px solid var(--hairline)",
                alignItems: "flex-start",
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: a.flag ? "var(--amber-bg)" : "var(--paper-tint)",
                  color: a.flag ? "var(--amber)" : "var(--ink-600)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <Icon name={a.icon} size={13} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--ink-950)" }}>{a.actor}</div>
                  <div style={{ fontSize: 11.5, color: "var(--ink-600)", marginTop: 1 }}>{a.meta}</div>
                </div>
                <span className="mono" style={{ fontSize: 10.5, color: "var(--ink-400)", flexShrink: 0 }}>{a.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick controls */}
      <div className="grid-3 reveal" data-d="7" style={{ gap: 14 }}>
        <AdminQuickCard title="Manage users" sub="1,840 freelancers · 642 clients" icon="user" badge="3 pending KYC" onClick={() => onNav("admin-users")} />
        <AdminQuickCard title="Platform wallet" sub="₹38.4L in escrow · ₹1.2Cr available" icon="wallet" badge="2 disputes" onClick={() => onNav("admin-wallet")} />
        <AdminQuickCard title="Marketplace controls" sub="Categories, featured, payouts" icon="settings" badge="—" onClick={() => {}} />
      </div>
    </div>
  );
}

function AdminQuickCard({ title, sub, icon, badge, onClick }) {
  return (
    <button onClick={onClick} className="card" style={{
      cursor: "pointer", textAlign: "left", fontFamily: "inherit",
      border: "1px solid var(--hairline)",
      transition: "border-color 0.12s ease, transform 0.12s ease",
    }} onMouseOver={e => e.currentTarget.style.borderColor = "var(--hairline-strong)"}
       onMouseOut={e => e.currentTarget.style.borderColor = "var(--hairline)"}>
      <div className="row between" style={{ marginBottom: 14 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: "var(--ink-950)", color: "white",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Icon name={icon} size={16} />
        </div>
        <Icon name="arrowUpRight" size={14} className="muted" />
      </div>
      <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--ink-950)", letterSpacing: "-0.005em" }}>{title}</div>
      <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{sub}</div>
      {badge !== "—" && (
        <div style={{ marginTop: 12 }}>
          <span className="badge amber"><span className="bdot"></span>{badge}</span>
        </div>
      )}
    </button>
  );
}

// =========================================================
// Admin Users
// =========================================================
function AdminUsers({ onNav, isMobile, pushToast }) {
  const [q, setQ] = React.useState("");
  const [role, setRole] = React.useState("all");
  const [status, setStatus] = React.useState("all");
  const [selected, setSelected] = React.useState(null);

  const users = window.MM.ADMIN_USERS;
  const filtered = users.filter(u => {
    if (q && !(u.name + u.org + u.city).toLowerCase().includes(q.toLowerCase())) return false;
    if (role !== "all" && u.role.toLowerCase() !== role) return false;
    if (status !== "all" && u.status !== status) return false;
    return true;
  });
  const counts = {
    all: users.length,
    client: users.filter(u => u.role === "Client").length,
    freelancer: users.filter(u => u.role === "Freelancer").length,
  };

  return (
    <div className="stack-6">
      <div className="row between reveal" data-d="0" style={{ flexWrap: "wrap", gap: 12 }}>
        <div>
          <div className="h-eyebrow" style={{ marginBottom: 4 }}>Admin</div>
          <h1 className="h-display h-1" style={{ margin: 0 }}>Users</h1>
          <p className="muted" style={{ marginTop: 6 }}>{filtered.length} of {users.length} accounts</p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn ghost"><Icon name="download" /> Export CSV</button>
          <button className="btn primary"><Icon name="plus" /> Invite user</button>
        </div>
      </div>

      <div className="card reveal" data-d="1" style={{ padding: 14 }}>
        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          <div className="input-with-prefix" style={{ flex: 1, minWidth: 200 }}>
            <span className="prefix"><Icon name="search" size={13} /></span>
            <input className="input" placeholder="Search by name, org, city…" value={q} onChange={e => setQ(e.target.value)} style={{ paddingLeft: 32 }} />
          </div>
          <Tabs value={role} onChange={setRole} items={[
            { value: "all",        label: "All",         count: counts.all },
            { value: "client",     label: "Clients",     count: counts.client },
            { value: "freelancer", label: "Freelancers", count: counts.freelancer },
          ]} />
          <select className="select" value={status} onChange={e => setStatus(e.target.value)} style={{ width: 150 }}>
            <option value="all">All status</option>
            <option value="active">Active</option>
            <option value="pending">Pending KYC</option>
            <option value="flagged">Flagged</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
      </div>

      <div className="card reveal" data-d="2" style={{ padding: 0, overflow: "hidden" }}>
        {filtered.length === 0 ? (
          <div className="empty" style={{ border: 0, padding: 48 }}>
            <div className="empty-glyph"><Icon name="user" /></div>
            <h3>No users match</h3>
            <p>Try clearing filters, or invite someone new.</p>
          </div>
        ) : (
          <>
            {!isMobile && (
              <div style={{
                display: "grid", gridTemplateColumns: "minmax(220px, 1.6fr) 1fr 1fr 1fr 1fr 64px",
                gap: 12, padding: "12px 18px",
                fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em",
                color: "var(--ink-500)", fontWeight: 500,
                borderBottom: "1px solid var(--hairline)", background: "var(--paper-tint)",
              }}>
                <div>User</div><div>Org</div><div>Joined</div><div>Status</div><div style={{ textAlign: "right" }}>Spend</div><div></div>
              </div>
            )}
            {filtered.map((u, i) => (
              <UserRow key={u.id} u={u} isMobile={isMobile} onClick={() => setSelected(u)} top={i === 0} />
            ))}
          </>
        )}
      </div>

      {selected && (
        <UserDetailDrawer u={selected} onClose={() => setSelected(null)} pushToast={pushToast} />
      )}
    </div>
  );
}

function UserRow({ u, isMobile, onClick, top }) {
  const statusTone = {
    active: "mint", pending: "amber", flagged: "rose", suspended: "neutral",
  }[u.status] || "neutral";
  if (isMobile) {
    return (
      <button onClick={onClick} style={{
        display: "flex", gap: 12, padding: "14px 18px",
        background: "transparent", border: 0, width: "100%", textAlign: "left",
        borderTop: top ? "0" : "1px solid var(--hairline)", cursor: "pointer", fontFamily: "inherit",
      }}>
        <Avatar initials={u.initials} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="row" style={{ gap: 6 }}>
            <span style={{ fontWeight: 500, fontSize: 13.5 }}>{u.name}</span>
            <span className={`badge ${statusTone}`} style={{ fontSize: 10 }}>{u.status}</span>
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{u.role} · {u.org} · {u.city}</div>
          <div className="mono" style={{ fontSize: 11.5, color: "var(--ink-900)", marginTop: 4 }}>{rupee(u.spend)} lifetime</div>
        </div>
        <Icon name="arrowRight" size={12} className="muted" />
      </button>
    );
  }
  return (
    <button onClick={onClick} style={{
      display: "grid", gridTemplateColumns: "minmax(220px, 1.6fr) 1fr 1fr 1fr 1fr 64px",
      gap: 12, padding: "14px 18px", alignItems: "center",
      background: "transparent", border: 0, width: "100%", textAlign: "left",
      borderTop: top ? "0" : "1px solid var(--hairline)", cursor: "pointer", fontFamily: "inherit",
      transition: "background 0.1s ease",
    }} onMouseOver={e => e.currentTarget.style.background = "var(--paper-tint)"}
       onMouseOut={e => e.currentTarget.style.background = "transparent"}>
      <div className="row" style={{ gap: 10 }}>
        <Avatar initials={u.initials} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 500, fontSize: 13.5, color: "var(--ink-950)" }}>{u.name}</div>
          <div className="muted" style={{ fontSize: 11.5, marginTop: 1 }}>{u.role}{u.rating ? ` · ★ ${u.rating}` : ""}</div>
        </div>
      </div>
      <div>
        <div style={{ fontSize: 12.5, color: "var(--ink-900)" }}>{u.org}</div>
        <div className="muted" style={{ fontSize: 11.5, marginTop: 1 }}>{u.city}</div>
      </div>
      <div className="mono" style={{ fontSize: 12 }}>{u.joined}</div>
      <div>
        <span className={`badge ${statusTone}`}>
          <span className="bdot"></span>{u.status}
        </span>
        {u.kyc !== "verified" && (
          <div style={{ fontSize: 10.5, color: "var(--ink-500)", marginTop: 3 }}>KYC: {u.kyc}</div>
        )}
      </div>
      <div className="mono" style={{ fontSize: 13, textAlign: "right", fontWeight: 500 }}>{rupee(u.spend)}</div>
      <div style={{ textAlign: "right", color: "var(--ink-400)" }}>
        <Icon name="more" size={14} />
      </div>
    </button>
  );
}

function UserDetailDrawer({ u, onClose, pushToast }) {
  function action(label) {
    pushToast({ title: label, body: `${u.name} · action recorded` });
    onClose();
  }
  return (
    <Modal title={u.name} subtitle={`${u.role} · ${u.org}`} onClose={onClose} maxWidth={520}
      footer={
        <>
          <button className="btn ghost" onClick={() => action("Reset password sent")}>
            <Icon name="refresh" /> Reset password
          </button>
          {u.status === "active" ? (
            <button className="btn danger" onClick={() => action("Account suspended")}>
              <Icon name="lock" /> Suspend
            </button>
          ) : u.status === "suspended" ? (
            <button className="btn mint" onClick={() => action("Account reinstated")}>
              <Icon name="check" /> Reinstate
            </button>
          ) : (
            <button className="btn primary" onClick={() => action("KYC approved")}>
              <Icon name="check" /> Approve KYC
            </button>
          )}
        </>
      }>
      <div className="stack" style={{ gap: 14 }}>
        <div className="row" style={{ gap: 14 }}>
          <Avatar name={u.name} initials={u.initials} size="lg" />
          <div>
            <div className="row" style={{ gap: 6, marginBottom: 2 }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>{u.name}</span>
              <span className={`badge ${u.status === "active" ? "mint" : u.status === "flagged" ? "rose" : "amber"}`}>
                <span className="bdot"></span>{u.status}
              </span>
            </div>
            <div className="muted" style={{ fontSize: 12 }}>{u.city} · joined {u.joined}</div>
          </div>
        </div>

        <div className="grid-3" style={{ gap: 10 }}>
          <KV label="Lifetime spend" v={rupee(u.spend)} />
          <KV label="KYC" v={u.kyc} />
          <KV label="Role" v={u.role} />
        </div>

        {u.rating && (
          <div className="card-tint" style={{ padding: 14 }}>
            <div className="row between">
              <span className="muted" style={{ fontSize: 12 }}>Marketplace rating</span>
              <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>★ {u.rating}</span>
            </div>
          </div>
        )}

        {u.status === "flagged" && (
          <div className="card" style={{ background: "var(--rose-bg)", border: "1px solid oklch(0.88 0.06 25)", padding: 12 }}>
            <div style={{ fontWeight: 500, color: "var(--rose)", fontSize: 13 }}>
              <Icon name="shield" size={13} /> Profile flagged — suspected fake portfolio
            </div>
            <div style={{ fontSize: 12, color: "var(--ink-700)", marginTop: 6, lineHeight: 1.55 }}>
              3 portfolio pieces matched against existing creator-economy databases. Manual review recommended.
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function KV({ label, v }) {
  return (
    <div style={{
      background: "var(--paper-tint)", border: "1px solid var(--hairline)",
      borderRadius: "var(--radius-sm)", padding: 10,
    }}>
      <div className="muted" style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-950)", marginTop: 4 }}>{v}</div>
    </div>
  );
}

// =========================================================
// Admin Negotiations approval
// =========================================================
function AdminNegotiations({ isMobile, pushToast }) {
  const [items, setItems] = React.useState(window.MM.ADMIN_NEGOTIATIONS);
  const [activeId, setActiveId] = React.useState(items[0]?.id);
  const active = items.find(n => n.id === activeId);

  function decide(verdict) {
    pushToast({
      title: verdict === "approve" ? "Approved & deal locked" : "Sent back for renegotiation",
      body: active.job,
    });
    const next = items.filter(n => n.id !== active.id);
    setItems(next);
    setActiveId(next[0]?.id);
  }

  if (items.length === 0) {
    return (
      <div className="stack-6">
        <div>
          <div className="h-eyebrow" style={{ marginBottom: 4 }}>Admin</div>
          <h1 className="h-display h-1" style={{ margin: 0 }}>Negotiations approval</h1>
        </div>
        <div className="empty">
          <div className="empty-glyph"><Icon name="check" size={22} /></div>
          <h3>Queue is empty</h3>
          <p>Every flagged deal is resolved. Mint AI watches the rest live.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="stack-6">
      <div className="row between reveal" data-d="0" style={{ flexWrap: "wrap", gap: 12 }}>
        <div>
          <div className="h-eyebrow" style={{ marginBottom: 4 }}>Admin</div>
          <h1 className="h-display h-1" style={{ margin: 0 }}>Negotiations approval</h1>
          <p className="muted" style={{ marginTop: 6 }}>{items.length} deal{items.length === 1 ? "" : "s"} awaiting your sign-off</p>
        </div>
        <div className="row" style={{ gap: 6 }}>
          <span className="badge amber"><span className="bdot"></span> {items.length} flagged</span>
        </div>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "320px 1fr",
        gap: 16,
        alignItems: "start",
      }}>
        {/* Queue list */}
        <div className="card reveal" data-d="1" style={{ padding: 6, position: isMobile ? "static" : "sticky", top: 80 }}>
          {items.map(n => (
            <button key={n.id} onClick={() => setActiveId(n.id)}
              style={{
                display: "block", width: "100%", textAlign: "left",
                padding: "12px 12px", borderRadius: 10, background: n.id === activeId ? "var(--paper-tint)" : "transparent",
                border: 0, cursor: "pointer", fontFamily: "inherit",
                borderLeft: n.id === activeId ? "2px solid var(--ink-950)" : "2px solid transparent",
              }}>
              <div className="row between" style={{ marginBottom: 4 }}>
                <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--ink-950)" }}>{n.job}</span>
                <span className="mono" style={{ fontSize: 11, color: "var(--ink-500)" }}>{n.submitted}</span>
              </div>
              <div className="muted" style={{ fontSize: 11.5, marginBottom: 6 }}>
                {n.client.name} ↔ {n.freelancer.name}
              </div>
              <div className="row between">
                <span className="badge amber" style={{ fontSize: 10 }}>R{n.rounds}/{n.max_rounds}</span>
                <span className="mono" style={{ fontSize: 12, fontWeight: 600 }}>{rupee(n.final_price)}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Active deal */}
        {active && (
          <div className="stack" style={{ gap: 16 }}>
            <div className="card reveal" data-d="2">
              <div className="row between" style={{ marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
                <div>
                  <h2 className="h-display h-2" style={{ margin: 0 }}>{active.job}</h2>
                  <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>Submitted {active.submitted} · final round at ₹{active.final_price.toLocaleString("en-IN")}</div>
                </div>
                <span className="badge amber"><span className="bdot"></span> Flagged for review</span>
              </div>

              <div className="card-tint" style={{ padding: 12, marginBottom: 16 }}>
                <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ink-500)", marginBottom: 6 }}>
                  Reason
                </div>
                <div style={{ fontSize: 13, color: "var(--ink-900)", lineHeight: 1.55 }}>
                  {active.flagged_reason}
                </div>
              </div>

              <div className="grid-3" style={{ gap: 10, marginBottom: 16 }}>
                <KV label="Original budget" v={rupee(active.original_budget)} />
                <KV label="Final price" v={rupee(active.final_price)} />
                <KV label="Delivery" v={`${active.delivery_days} days`} />
              </div>

              <div className="row" style={{ gap: 16, marginBottom: 14, flexWrap: "wrap" }}>
                <PartyChip a={active.client} role="Client" />
                <span style={{ color: "var(--ink-400)" }}>↔</span>
                <PartyChip a={active.freelancer} role="Freelancer" />
              </div>

              {/* History */}
              <div className="h-eyebrow" style={{ marginBottom: 10 }}>Round history</div>
              <div className="nego-board" style={{ background: "transparent", padding: 0, border: 0 }}>
                {active.history.map((r, i) => (
                  <div key={i} className={`offer-card ${r.who === "freelancer" ? "them" : "me"}`} style={{ maxWidth: "85%" }}>
                    <div className="who-row">
                      <Avatar initials={(r.who === "client" ? active.client.initials : active.freelancer.initials)} size="sm" />
                      <span className="who-name">{r.who === "client" ? active.client.name : active.freelancer.name}</span>
                      <span className="muted">· Round {i + 1}</span>
                    </div>
                    <div className="offer-row">
                      <span className="big">{rupee(r.price)}</span>
                      <span className="small">in {r.days} days</span>
                    </div>
                    <div className="msg">{r.msg}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Decision */}
            <div className="card reveal" data-d="3" style={{ background: "var(--ink-950)", color: "white", border: 0 }}>
              <div className="row between" style={{ flexWrap: "wrap", gap: 12 }}>
                <div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 600, marginBottom: 4 }}>
                    Approve this deal?
                  </div>
                  <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.7)", lineHeight: 1.55, maxWidth: 540 }}>
                    Approval locks the price at <span className="mono" style={{ color: "white", fontWeight: 600 }}>{rupee(active.final_price)}</span>, moves <span className="mono" style={{ color: "white", fontWeight: 600 }}>{rupee(active.final_price)}</span> into escrow, and sends a notification to both parties. This action is logged.
                  </div>
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <button className="btn" style={{ background: "rgba(255,255,255,0.10)", color: "white", border: "1px solid rgba(255,255,255,0.16)" }} onClick={() => decide("reject")}>
                    <Icon name="refresh" /> Send back
                  </button>
                  <button className="btn mint" onClick={() => decide("approve")}>
                    <Icon name="check" /> Approve &amp; lock
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PartyChip({ a, role }) {
  return (
    <div className="row" style={{ gap: 10 }}>
      <Avatar initials={a.initials} />
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-950)" }}>{a.name}</div>
        <div className="muted" style={{ fontSize: 11.5 }}>{role}{a.org ? ` · ${a.org}` : ""}</div>
      </div>
    </div>
  );
}

// =========================================================
// Admin Wallet management
// =========================================================
function AdminWallet({ isMobile, pushToast }) {
  const w = window.MM.PLATFORM_WALLET;
  const [filter, setFilter] = React.useState("all");

  const types = {
    topup: { label: "Top-up", tone: "mint", icon: "arrowUpRight" },
    escrow: { label: "Escrow", tone: "neutral", icon: "lock" },
    release: { label: "Release", tone: "sky", icon: "check" },
    payout: { label: "Payout", tone: "violet", icon: "send" },
    fee: { label: "Fee", tone: "amber", icon: "rupee" },
    refund: { label: "Refund", tone: "rose", icon: "refresh" },
  };

  const filtered = w.recent_movements.filter(m => filter === "all" ? true : m.type === filter);

  return (
    <div className="stack-6">
      <div className="row between reveal" data-d="0" style={{ flexWrap: "wrap", gap: 12 }}>
        <div>
          <div className="h-eyebrow" style={{ marginBottom: 4 }}>Admin</div>
          <h1 className="h-display h-1" style={{ margin: 0 }}>Platform wallet</h1>
          <p className="muted" style={{ marginTop: 6 }}>Live ledger · Razorpay + ICICI escrow account · settled T+0</p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn ghost"><Icon name="download" /> Export ledger</button>
          <button className="btn primary"><Icon name="refresh" /> Reconcile</button>
        </div>
      </div>

      <div className="grid-4" style={{ gap: 14 }}>
        <BigStat label="Escrow held" value={rupee(w.total_escrow)} sub="across 312 jobs" tone="amber" />
        <BigStat label="Available balance" value={rupee(w.available_balance)} sub="settled funds" tone="mint" />
        <BigStat label="Pending payouts" value={rupee(w.pending_payouts)} sub="next batch in 2h" tone="sky" />
        <BigStat label="Fees MTD" value={rupee(w.fees_mtd)} sub="+18% MoM" tone="violet" />
      </div>

      {/* Reconciliation */}
      <div className="card reveal" data-d="2" style={{ background: "var(--mint-50)", border: "1px solid var(--mint-200)" }}>
        <div className="row between" style={{ flexWrap: "wrap", gap: 12 }}>
          <div className="row" style={{ gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--mint-600)", color: "white", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="check" />
            </div>
            <div>
              <div style={{ fontWeight: 600, color: "var(--ink-950)" }}>Reconciled at 11:30 IST · all green</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>Razorpay ledger matches platform ledger. Next auto-reconcile at 12:00.</div>
            </div>
          </div>
          <div className="mono" style={{ fontSize: 12, color: "var(--ink-700)" }}>
            Δ ₹0.00 · 18m ago
          </div>
        </div>
      </div>

      {/* Movements */}
      <div className="card reveal" data-d="3" style={{ padding: 0 }}>
        <div className="row between" style={{ padding: "16px 18px", borderBottom: "1px solid var(--hairline)", flexWrap: "wrap", gap: 8 }}>
          <h3 className="h-display h-3" style={{ margin: 0 }}>Recent movements</h3>
          <Tabs value={filter} onChange={setFilter} items={[
            { value: "all",     label: "All" },
            { value: "topup",   label: "Top-ups" },
            { value: "escrow",  label: "Escrow" },
            { value: "release", label: "Releases" },
            { value: "fee",     label: "Fees" },
            { value: "refund",  label: "Refunds" },
          ]} />
        </div>
        {filtered.length === 0 ? (
          <div className="empty" style={{ border: 0, padding: 32 }}>
            <div className="empty-glyph"><Icon name="wallet" /></div>
            <h3>No movements in this filter</h3>
          </div>
        ) : filtered.map((m, i) => {
          const t = types[m.type] || types.fee;
          return (
            <div key={m.id} style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "auto 1fr auto" : "auto 1fr 1fr 1fr",
              gap: 12, alignItems: "center", padding: "14px 18px",
              borderTop: i === 0 ? "0" : "1px solid var(--hairline)",
            }}>
              <div style={{
                width: 30, height: 30, borderRadius: 8,
                background: "var(--paper-tint)", color: "var(--ink-700)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Icon name={t.icon} size={13} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-950)" }}>{m.actor}</div>
                <div className="mono" style={{ fontSize: 11, color: "var(--ink-500)", marginTop: 2 }}>{m.ref} · {m.time}</div>
              </div>
              {!isMobile && <span className={`badge ${t.tone}`}><span className="bdot"></span>{t.label}</span>}
              <div className="mono" style={{
                fontSize: 14, fontWeight: 600, textAlign: "right",
                color: m.amt < 0 ? "var(--ink-900)" : "var(--mint-700)",
              }}>
                {m.amt > 0 ? "+" : ""}{rupee(m.amt)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BigStat({ label, value, sub, tone }) {
  return (
    <div className="card reveal" data-d="1" style={{ padding: 16 }}>
      <div className="row" style={{ gap: 8 }}>
        <span className={`bdot`} style={{
          width: 7, height: 7, borderRadius: "50%",
          background: tone === "amber" ? "var(--amber)" : tone === "sky" ? "var(--sky)" : tone === "violet" ? "var(--violet)" : "var(--mint-500)",
        }}></span>
        <span style={{ fontSize: 11.5, color: "var(--ink-500)", fontWeight: 500 }}>{label}</span>
      </div>
      <div className="mono" style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600, color: "var(--ink-950)", marginTop: 8, letterSpacing: "-0.02em" }}>
        {value}
      </div>
      <div className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>{sub}</div>
    </div>
  );
}

Object.assign(window, {
  AdminDashboard, AdminUsers, AdminNegotiations, AdminWallet, Spark,
});
