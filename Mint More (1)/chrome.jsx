// App chrome — sidebar, topbar, mobile bottom nav

function Logo() {
  return (
    <div className="sidebar-logo">
      <span className="wordmark">
        Mint<span className="more">more</span>
      </span>
    </div>
  );
}

const NAV_CLIENT = [
  {
    label: "Workspace",
    items: [
      { key: "dashboard",     label: "Dashboard",     icon: "home" },
      { key: "jobs",          label: "Jobs",          icon: "briefcase", count: 4 },
      { key: "wallet",        label: "Wallet",        icon: "wallet" },
      { key: "notifications", label: "Inbox",         icon: "bell",      count: 2 },
    ],
  },
  {
    label: "Creative",
    items: [
      { key: "freelancers", label: "Marketplace", icon: "user" },
      { key: "social",      label: "Social",      icon: "layers" },
      { key: "mintai",      label: "Mint AI",     icon: "sparkles" },
    ],
  },
  {
    label: "Account",
    items: [
      { key: "chat",     label: "Messages", icon: "chat", count: 2 },
      { key: "settings", label: "Settings", icon: "settings" },
    ],
  },
];

const NAV_ADMIN = [
  {
    label: "Platform",
    items: [
      { key: "dashboard",    label: "Dashboard",     icon: "home" },
      { key: "admin-users",  label: "Users",         icon: "user",   count: "1.8K" },
      { key: "admin-negos",  label: "Approvals",     icon: "shield", count: 3 },
      { key: "admin-wallet", label: "Platform wallet", icon: "wallet" },
    ],
  },
  {
    label: "Operations",
    items: [
      { key: "freelancers", label: "Marketplace", icon: "layers" },
      { key: "mintai",      label: "Mint AI",     icon: "sparkles" },
    ],
  },
  {
    label: "Account",
    items: [
      { key: "settings", label: "Settings", icon: "settings" },
    ],
  },
];

const NAV_FREELANCER = [
  {
    label: "Work",
    items: [
      { key: "dashboard",     label: "Dashboard",     icon: "home" },
      { key: "jobs",          label: "Jobs",          icon: "briefcase", count: 3 },
      { key: "inquiries",     label: "Inquiries",     icon: "chat",      count: 2 },
      { key: "wallet",        label: "Earnings",      icon: "wallet" },
      { key: "notifications", label: "Inbox",         icon: "bell",      count: 3 },
    ],
  },
  {
    label: "Marketplace",
    items: [
      { key: "profile-edit", label: "Profile",   icon: "user" },
      { key: "packages",     label: "Packages",  icon: "layers" },
      { key: "portfolio",    label: "Portfolio", icon: "image" },
    ],
  },
  {
    label: "Account",
    items: [
      { key: "mintai",   label: "Mint AI",  icon: "sparkles" },
      { key: "settings", label: "Settings", icon: "settings" },
    ],
  },
];

function Sidebar({ route, onNav, role }) {
  const groups = role === "admin" ? NAV_ADMIN
    : role === "freelancer" ? NAV_FREELANCER
    : NAV_CLIENT;
  const user = role === "admin" ? window.MM.ADMIN
    : role === "freelancer" ? window.MM.FREELANCER
    : window.MM.USER;
  const subline = role === "admin"
    ? `${user.role} · ${user.city}`
    : role === "freelancer"
      ? `${user.city} · ${user.level}`
      : `${user.business} · Client`;
  return (
    <aside className="sidebar">
      <Logo />
      {groups.map(group => (
        <div className="sidebar-section" key={group.label}>
          <div className="sidebar-section-label">{group.label}</div>
          {group.items.map(it => {
            const active = route.startsWith(it.key) || (it.key === "jobs" && route === "job-detail");
            return (
              <button
                key={it.key}
                className={`nav-item ${active ? "active" : ""}`}
                onClick={() => onNav(it.key)}
              >
                <Icon name={it.icon} className="nav-icon" size={15} />
                <span>{it.label}</span>
                {it.count && <span className="count">{it.count}</span>}
              </button>
            );
          })}
        </div>
      ))}
      <div className="sidebar-footer">
        <Avatar name={user.name} />
        <div className="user-block">
          <div className="name">{user.name}</div>
          <div className="role">{subline}</div>
        </div>
      </div>
    </aside>
  );
}

function Topbar({ title, eyebrow, actions, walletBalance, onWalletClick, onNotifClick, notifUnread }) {
  return (
    <header className="topbar">
      <div>
        {eyebrow && <div className="h-eyebrow" style={{ marginBottom: 2 }}>{eyebrow}</div>}
        <h1>{title}</h1>
      </div>
      <div className="topbar-actions">
        {actions}
        <button className="wallet-chip" onClick={onWalletClick}>
          <span className="dot"></span>
          <span className="muted">Wallet</span>
          <span className="amt">{rupee(walletBalance)}</span>
        </button>
        <button className="icon-btn" onClick={onNotifClick} aria-label="Notifications">
          <Icon name="bell" />
          {notifUnread && <span className="pip"></span>}
        </button>
      </div>
    </header>
  );
}

function MobileTopbar({ title, onBack, onMenu, right }) {
  return (
    <div className="mob-topbar">
      {onBack ? (
        <button className="back" onClick={onBack} aria-label="Back">
          <Icon name="arrowLeft" size={13} />
        </button>
      ) : onMenu ? (
        <button className="back" onClick={onMenu} aria-label="Menu">
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M2 4h12M2 8h12M2 12h12" /></svg>
        </button>
      ) : (
        <div className="mob-logo">
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, letterSpacing: "-0.02em" }}>Mint<span style={{ color: "var(--mint-700)", fontStyle: "italic", fontWeight: 500 }}>more</span></span>
        </div>
      )}
      <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 600, letterSpacing: "-0.01em", flex: 1, textAlign: onBack ? "left" : "center" }}>{title}</h1>
      <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>{right}</div>
    </div>
  );
}

function MobileBottomNav({ route, onNav, role }) {
  const clientItems = [
    { key: "dashboard", label: "Home", icon: "home" },
    { key: "jobs",      label: "Jobs", icon: "briefcase" },
    { key: "post",      label: "Post", icon: "plus", fab: true },
    { key: "wallet",    label: "Wallet", icon: "wallet" },
    { key: "chat",      label: "Inbox", icon: "chat" },
  ];
  const flItems = [
    { key: "dashboard", label: "Home", icon: "home" },
    { key: "jobs",      label: "Briefs", icon: "briefcase" },
    { key: "inquiries", label: "Inquiries", icon: "chat" },
    { key: "wallet",    label: "Earnings", icon: "wallet" },
    { key: "profile-edit", label: "Profile", icon: "user" },
  ];
  const adminItems = [
    { key: "dashboard",    label: "Home",    icon: "home" },
    { key: "admin-users",  label: "Users",   icon: "user" },
    { key: "admin-negos",  label: "Approve", icon: "shield" },
    { key: "admin-wallet", label: "Wallet",  icon: "wallet" },
    { key: "mintai",       label: "AI",      icon: "sparkles" },
  ];
  const items = role === "admin" ? adminItems : role === "freelancer" ? flItems : clientItems;
  return (
    <nav className="mobile-bottom-nav">
      {items.map(it => {
        const active = route.startsWith(it.key) || (it.key === "jobs" && route === "job-detail") || (it.key === "post" && route === "post-job");
        return (
          <button key={it.key} className={`mob-tab ${active ? "active" : ""}`} onClick={() => onNav(it.key === "post" ? "post-job" : it.key)}>
            {it.fab ? (
              <div className="fab-circle"><Icon name={it.icon} size={16} strokeWidth={2.2} /></div>
            ) : (
              <Icon name={it.icon} size={18} />
            )}
            <span>{it.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

Object.assign(window, { Sidebar, Topbar, MobileTopbar, MobileBottomNav, Logo });
