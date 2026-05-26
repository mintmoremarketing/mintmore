// App entry — router + frame toggle + role switcher (client / freelancer / admin)

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(err, info) { console.error("Mintmore caught:", err, info); }
  reset = () => this.setState({ error: null });
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, maxWidth: 520, margin: "60px auto" }}>
          <div className="error-banner" style={{ marginBottom: 14 }}>
            <Icon name="shield" size={16} />
            <div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Something went sideways.</div>
              <div style={{ fontSize: 12.5, color: "var(--ink-700)" }}>
                The screen hit an unexpected state. We've logged it. You can recover without losing context.
              </div>
            </div>
          </div>
          <pre style={{
            background: "var(--paper-tint)", border: "1px solid var(--hairline)",
            borderRadius: 8, padding: 12, fontSize: 11, fontFamily: "var(--font-mono)",
            color: "var(--ink-700)", overflow: "auto", maxHeight: 160,
          }}>{String(this.state.error?.message || this.state.error)}</pre>
          <div className="row" style={{ gap: 8, marginTop: 14 }}>
            <button className="btn primary" onClick={this.reset}><Icon name="refresh" /> Try again</button>
            <button className="btn ghost" onClick={() => location.reload()}>Reload app</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  const [authed, setAuthed] = React.useState(false);
  const [frame, setFrame] = React.useState("desktop"); // desktop | mobile
  const [role, setRole] = React.useState("client");    // client | freelancer
  const [route, setRoute] = React.useState("dashboard");
  const [jobId, setJobId] = React.useState(null);
  const [toasts, setToasts] = React.useState([]);
  const [showTopUp, setShowTopUp] = React.useState(false);
  const [showNotif, setShowNotif] = React.useState(false);

  const isMobile = frame === "mobile";

  function pushToast(t) {
    const id = "t" + Date.now() + Math.random();
    setToasts(list => [...list, { ...t, id }]);
    setTimeout(() => setToasts(list => list.filter(x => x.id !== id)), 3600);
  }

  function nav(r, id) {
    setRoute(r);
    if (id) setJobId(id);
    setShowNotif(false);
  }

  function signIn() {
    setAuthed(true);
    setRoute("dashboard");
    setTimeout(() => pushToast({
      title: role === "admin" ? "Welcome, Vivek" : `Welcome back, ${role === "freelancer" ? "Arjun" : "Priya"}`,
      body: role === "admin" ? "3 deals need your approval today"
        : role === "freelancer" ? "1 new match · 2 inquiries waiting"
        : "1 counter offer waiting for your move",
    }), 400);
  }

  function changeRole(newRole) {
    setRole(newRole);
    setRoute("dashboard");
    setJobId(null);
    if (authed) {
      const labels = { admin: "admin view · Vivek Nair", freelancer: "freelancer view · Arjun Mehta", client: "client view · Priya Sharma" };
      pushToast({ title: `Switched to ${newRole}`, body: `Viewing as ${labels[newRole]}` });
    }
  }

  if (!authed) {
    return (
      <>
        <ChromeBar frame={frame} onFrame={setFrame} role={role} onRole={changeRole} />
        {isMobile ? (
          <MobileStage><AuthScreen onSignIn={signIn} isMobile={true} /></MobileStage>
        ) : (
          <AuthScreen onSignIn={signIn} isMobile={false} />
        )}
        <ToastHost toasts={toasts} />
      </>
    );
  }

  const appContent = (
    <div className={`app ${isMobile ? "mobile" : ""}`}>
      {!isMobile && <Sidebar route={route} onNav={nav} role={role} />}
      <main style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        {isMobile ? (
          <MobileTopbar
            title={titleFor(route, role)}
            onBack={route !== "dashboard" ? () => nav("dashboard") : null}
            right={
              <button className="icon-btn" onClick={() => nav("notifications")}>
                <Icon name="bell" />
                <span className="pip"></span>
              </button>
            }
          />
        ) : role === "admin" ? (
          <Topbar
            title={titleFor(route, role)}
            eyebrow={eyebrowFor(route, role)}
            walletBalance={window.MM.PLATFORM_WALLET.available_balance}
            onWalletClick={() => nav("admin-wallet")}
            onNotifClick={() => setShowNotif(true)}
            notifUnread={true}
          />
        ) : (
          <Topbar
            title={titleFor(route, role)}
            eyebrow={eyebrowFor(route, role)}
            walletBalance={role === "freelancer" ? window.MM.FREELANCER_WALLET.available : window.MM.WALLET.available}
            onWalletClick={() => nav("wallet")}
            onNotifClick={() => nav("notifications")}
            notifUnread={true}
          />
        )}
        <div className="page">
          <ErrorBoundary>
            {renderRoute({ route, role, jobId, isMobile, nav, pushToast, onTopUp: () => setShowTopUp(true) })}
          </ErrorBoundary>
        </div>
        {isMobile && <MobileBottomNav route={route} onNav={nav} role={role} />}
      </main>
    </div>
  );

  return (
    <>
      <ChromeBar frame={frame} onFrame={setFrame} role={role} onRole={changeRole} />
      {isMobile ? <MobileStage>{appContent}</MobileStage> : appContent}
      <ToastHost toasts={toasts} />
      {showTopUp && <TopUpModal onClose={() => setShowTopUp(false)} pushToast={pushToast} />}
      {showNotif && <NotifPanel onClose={() => setShowNotif(false)} onNav={nav} />}
    </>
  );
}

function renderRoute({ route, role, jobId, isMobile, nav, pushToast, onTopUp }) {
  // ADMIN routes
  if (role === "admin") {
    switch (route) {
      case "dashboard":     return <AdminDashboard onNav={nav} isMobile={isMobile} />;
      case "admin-users":   return <AdminUsers onNav={nav} isMobile={isMobile} pushToast={pushToast} />;
      case "admin-negos":   return <AdminNegotiations isMobile={isMobile} pushToast={pushToast} />;
      case "admin-wallet":  return <AdminWallet isMobile={isMobile} pushToast={pushToast} />;
      case "freelancers":   return <BrowseFreelancers onNav={nav} isMobile={isMobile} pushToast={pushToast} />;
      case "mintai":        return <MintAI isMobile={isMobile} pushToast={pushToast} />;
      case "settings":      return <Stub title="Settings" />;
    }
    return <AdminDashboard onNav={nav} isMobile={isMobile} />;
  }
  // CLIENT routes
  if (role === "client") {
    switch (route) {
      case "dashboard":    return <Dashboard onNav={nav} isMobile={isMobile} onTopUp={onTopUp} />;
      case "jobs":         return <JobsList onNav={nav} isMobile={isMobile} />;
      case "post-job":     return <PostJob onNav={nav} isMobile={isMobile} onSubmit={() => { pushToast({ title: "Brief posted", body: "Matching creatives now — ~6 min" }); nav("jobs"); }} />;
      case "job-detail":   return <JobDetail jobId={jobId} onNav={nav} isMobile={isMobile} pushToast={pushToast} />;
      case "wallet":       return <Wallet onTopUp={onTopUp} isMobile={isMobile} pushToast={pushToast} />;
      case "notifications": return <NotificationsInbox onNav={nav} isMobile={isMobile} pushToast={pushToast} />;
      case "freelancers":  return <BrowseFreelancers onNav={nav} isMobile={isMobile} pushToast={pushToast} />;
      case "social":       return <SocialPublisher isMobile={isMobile} pushToast={pushToast} />;
      case "mintai":       return <MintAI isMobile={isMobile} pushToast={pushToast} />;
      case "chat":         return <MessagesStub isMobile={isMobile} />;
      case "settings":     return <SettingsStub />;
    }
  }
  // FREELANCER routes
  switch (route) {
    case "dashboard":     return <FreelancerDashboard onNav={nav} isMobile={isMobile} />;
    case "jobs":          return <FreelancerJobsList onNav={nav} isMobile={isMobile} />;
    case "job-detail":    return <FreelancerJobDetail jobId={jobId} onNav={nav} isMobile={isMobile} pushToast={pushToast} />;
    case "inquiries":     return <FreelancerInquiries onNav={nav} isMobile={isMobile} />;
    case "wallet":        return <Wallet onTopUp={onTopUp} isMobile={isMobile} pushToast={pushToast} />;
    case "profile-edit":  return <MarketplaceProfile onNav={nav} isMobile={isMobile} pushToast={pushToast} />;
    case "packages":      return <PackagesEditor isMobile={isMobile} pushToast={pushToast} />;
    case "portfolio":     return <PortfolioManager isMobile={isMobile} pushToast={pushToast} />;
    case "notifications": return <NotificationsInbox onNav={nav} isMobile={isMobile} pushToast={pushToast} />;
    case "mintai":        return <MintAI isMobile={isMobile} pushToast={pushToast} />;
    case "settings":      return <SettingsStub />;
  }
  return <Stub title="Coming next" />;
}

// Messages — light interactive stub for client "chat" route
function MessagesStub({ isMobile }) {
  const threads = [
    { id: "th1", name: "Arjun Mehta", initials: "AM", subject: "Instagram reel pack — round 4", last: "Meet in the middle at ₹20.5k?", time: "12m", unread: 2 },
    { id: "th2", name: "Kavya Iyer",  initials: "KI", subject: "Winter photoshoot — proofs",   last: "Sending proofs by 8 PM today.", time: "2h", unread: 0 },
    { id: "th3", name: "Rohan Pillai", initials: "RP", subject: "Logo refresh — wrapped",       last: "Thanks Priya — was a pleasure.", time: "3d", unread: 0 },
  ];
  const [active, setActive] = React.useState(threads[0]);
  return (
    <div className="stack-6">
      <div>
        <div className="h-eyebrow" style={{ marginBottom: 4 }}>Inbox</div>
        <h1 className="h-display h-1" style={{ margin: 0 }}>Messages</h1>
        <p className="muted" style={{ marginTop: 6 }}>3 active conversations · auto-archives after 60 days of silence.</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "320px 1fr", gap: 16 }}>
        <div className="card" style={{ padding: 6 }}>
          {threads.map(t => (
            <button key={t.id} onClick={() => setActive(t)} style={{
              display: "flex", gap: 10, padding: 12, alignItems: "flex-start",
              background: t.id === active.id ? "var(--paper-tint)" : "transparent",
              border: 0, width: "100%", textAlign: "left", cursor: "pointer", fontFamily: "inherit",
              borderRadius: 8,
            }}>
              <Avatar initials={t.initials} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="row between">
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{t.name}</span>
                  <span className="mono" style={{ fontSize: 10.5, color: "var(--ink-500)" }}>{t.time}</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--ink-700)", marginTop: 2 }}>{t.subject}</div>
                <div className="muted" style={{ fontSize: 11.5, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.last}</div>
              </div>
              {t.unread > 0 && <span className="badge mint" style={{ fontSize: 10 }}>{t.unread}</span>}
            </button>
          ))}
        </div>
        <div className="card" style={{ padding: 0, overflow: "hidden", minHeight: 360 }}>
          <div className="row" style={{ padding: 14, borderBottom: "1px solid var(--hairline)", gap: 10 }}>
            <Avatar initials={active.initials} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{active.name}</div>
              <div className="muted" style={{ fontSize: 11.5 }}>{active.subject}</div>
            </div>
          </div>
          <div style={{ padding: 16, background: "var(--paper-tint)", minHeight: 320 }}>
            <div className="bubble-row them"><div className="bubble"><div className="who">{active.name}</div><div>{active.last}</div><span className="meta">{active.time}</span></div></div>
            <div className="bubble-row me"><div className="bubble"><div>Thanks — let me think about it and revert in 20 minutes.</div><span className="meta">just now</span></div></div>
          </div>
          <div className="row" style={{ padding: 12, gap: 8, borderTop: "1px solid var(--hairline)" }}>
            <button className="icon-btn"><Icon name="paperclip" size={13} /></button>
            <input className="input" placeholder="Type a message…" />
            <button className="btn primary"><Icon name="send" size={12} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsStub() {
  return (
    <div className="stack-6">
      <div>
        <div className="h-eyebrow" style={{ marginBottom: 4 }}>Account</div>
        <h1 className="h-display h-1" style={{ margin: 0 }}>Settings</h1>
        <p className="muted" style={{ marginTop: 6 }}>Profile, billing, notifications, integrations.</p>
      </div>
      <div className="grid-2" style={{ gap: 14 }}>
        {[
          { name: "Profile & account", sub: "Your name, email, phone, KYC", icon: "user" },
          { name: "Billing & invoicing", sub: "GSTIN, invoices, payout method", icon: "wallet" },
          { name: "Notifications", sub: "Email, SMS, WhatsApp, in-app", icon: "bell" },
          { name: "Integrations", sub: "Razorpay, social, Slack, Mint AI", icon: "layers" },
          { name: "Security", sub: "Password, 2FA, sessions", icon: "lock" },
          { name: "Team & roles", sub: "Invite teammates, set permissions", icon: "user" },
        ].map(s => (
          <div key={s.name} className="card" style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--paper-tint)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-700)" }}>
              <Icon name={s.icon} size={14} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink-950)" }}>{s.name}</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{s.sub}</div>
            </div>
            <Icon name="arrowRight" size={14} className="muted" />
          </div>
        ))}
      </div>
    </div>
  );
}

function titleFor(route, role) {
  const isFL = role === "freelancer";
  const isAdmin = role === "admin";
  return {
    dashboard:      isAdmin ? "Overview" : isFL ? "Workspace" : "Studio",
    jobs:           isFL ? "Briefs" : "Jobs",
    "post-job":     "Post a brief",
    "job-detail":   "Job",
    wallet:         isFL ? "Earnings" : "Wallet",
    "profile-edit": "Marketplace profile",
    packages:       "Packages",
    portfolio:      "Portfolio",
    inquiries:      "Inquiries",
    notifications:  "Inbox",
    freelancers:    "Marketplace",
    social:         "Social",
    mintai:         "Mint AI",
    chat:           "Messages",
    settings:       "Settings",
    "admin-users":  "Users",
    "admin-negos":  "Approvals",
    "admin-wallet": "Platform wallet",
  }[route] || "Mintmore";
}
function eyebrowFor(route, role) {
  if (route === "dashboard") {
    return role === "admin" ? "Mintmore admin"
      : role === "freelancer" ? "Arjun Mehta"
      : "Tilak Weaves";
  }
  return null;
}

function ChromeBar({ frame, onFrame, role, onRole }) {
  return (
    <div className="proto-chrome">
      <div style={{ display: "flex", gap: 2, borderRight: "1px solid var(--hairline)", paddingRight: 4, marginRight: 2 }}>
        <button className={role === "client" ? "active" : ""} onClick={() => onRole("client")}>
          <Icon name="shoppingBag" /> Client
        </button>
        <button className={role === "freelancer" ? "active" : ""} onClick={() => onRole("freelancer")}>
          <Icon name="zap" /> Freelancer
        </button>
        <button className={role === "admin" ? "active" : ""} onClick={() => onRole("admin")}>
          <Icon name="shield" /> Admin
        </button>
      </div>
      <button className={frame === "desktop" ? "active" : ""} onClick={() => onFrame("desktop")}>
        <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1.5" y="2.5" width="11" height="7" rx="1" /><path d="M5 12h4M7 9.5v2.5" strokeLinecap="round" /></svg>
        Desktop
      </button>
      <button className={frame === "mobile" ? "active" : ""} onClick={() => onFrame("mobile")}>
        <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3.5" y="1" width="7" height="12" rx="1.2" /><path d="M6.5 11.2h1" strokeLinecap="round" /></svg>
        Mobile
      </button>
    </div>
  );
}

function MobileStage({ children }) {
  return (
    <div className="mobile-frame-stage">
      <IOSFrame deviceColor="#1B2128" screenBackground="var(--paper-tint)" width={390} height={780} statusBarVariant="dark">
        {children}
      </IOSFrame>
    </div>
  );
}

function Stub({ title, sub }) {
  return (
    <div className="stack-6">
      <div>
        <div className="h-eyebrow" style={{ marginBottom: 4 }}>{title}</div>
        <h1 className="h-display h-1" style={{ margin: 0 }}>{title}</h1>
        {sub && <p className="muted" style={{ marginTop: 6 }} dangerouslySetInnerHTML={{ __html: sub }}></p>}
      </div>
      <div className="empty">
        <div className="empty-glyph"><Icon name="sparkles" size={22} /></div>
        <h3>Coming in a later phase</h3>
        <p>This screen isn't part of phases 1–3. Use the sidebar to navigate to live screens.</p>
      </div>
    </div>
  );
}

function NotifPanel({ onClose, onNav }) {
  return (
    <div className="modal-backdrop" onClick={onClose} style={{ alignItems: "flex-start", justifyContent: "flex-end", padding: 16 }}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 360, marginTop: 56 }}>
        <div className="modal-head">
          <div>
            <h2>Notifications</h2>
            <div className="subtitle">Live · {window.MM.NOTIFS_FULL.filter(n => n.unread).length} unread</div>
          </div>
          <button className="icon-btn" onClick={onClose}><Icon name="x" /></button>
        </div>
        <div className="modal-body" style={{ paddingTop: 8 }}>
          <div className="stack" style={{ gap: 0 }}>
            {window.MM.NOTIFS_FULL.slice(0, 5).map((n, i) => (
              <button
                key={n.id}
                onClick={() => { onClose(); if (n.jobId) onNav("job-detail", n.jobId); else if (n.type === "wallet") onNav("wallet"); }}
                style={{
                  background: "transparent", border: 0,
                  borderTop: i === 0 ? "0" : "1px solid var(--hairline)",
                  padding: "12px 0", display: "flex", gap: 12, alignItems: "flex-start", textAlign: "left", cursor: "pointer", width: "100%",
                  fontFamily: "inherit",
                }}
              >
                <NotifIcon type={n.type} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-950)" }}>{n.title}</div>
                  <div style={{ fontSize: 12, color: "var(--ink-500)", marginTop: 2 }}>{n.body}</div>
                </div>
                <div style={{ fontSize: 11, color: "var(--ink-400)", fontFamily: "var(--font-mono)" }}>{n.time}</div>
              </button>
            ))}
          </div>
          <button className="btn link sm" style={{ marginTop: 8, fontSize: 12 }} onClick={() => { onClose(); onNav("notifications"); }}>
            See all notifications <Icon name="arrowRight" size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
