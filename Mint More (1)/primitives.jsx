// Icons — single source. Stroke-based, 16px viewport, currentColor.
// Usage: <Icon name="briefcase" />
const I = {
  briefcase: 'M3 6h10v6H3zM6 6V4h4v2',
  wallet: 'M2 5h11a1 1 0 011 1v6a1 1 0 01-1 1H3a1 1 0 01-1-1V5zm0 0V4a1 1 0 011-1h8M11 9h1',
  sparkles: 'M8 1.5l1.2 2.8L12 5.5l-2.8 1.2L8 9.5 6.8 6.7 4 5.5l2.8-1.2zM3 10l.5 1.2 1.2.5-1.2.5L3 13.4l-.5-1.2-1.2-.5 1.2-.5zM12 11l.5 1.2 1.2.5-1.2.5-.5 1.2-.5-1.2-1.2-.5 1.2-.5z',
  chat: 'M2 4a1 1 0 011-1h9a1 1 0 011 1v6a1 1 0 01-1 1H6l-3 3v-3a1 1 0 01-1-1z',
  bell: 'M3.5 11h9l-1-2V6.5a3.5 3.5 0 10-7 0V9zM6.5 12.5a1.5 1.5 0 003 0',
  user: 'M8 8a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM3 13c0-2.2 2-4 5-4s5 1.8 5 4',
  search: 'M7 11.5a4.5 4.5 0 100-9 4.5 4.5 0 000 9zM10.5 10.5L13 13',
  plus: 'M8 3v10M3 8h10',
  arrowRight: 'M3 8h10M9 4l4 4-4 4',
  arrowLeft: 'M13 8H3M7 4l-4 4 4 4',
  arrowUpRight: 'M5 11l6-6M5 5h6v6',
  check: 'M3 8l3 3 7-7',
  x: 'M3.5 3.5l9 9M12.5 3.5l-9 9',
  chevronDown: 'M3 6l5 5 5-5',
  chevronRight: 'M6 3l5 5-5 5',
  upload: 'M8 2v8M4 6l4-4 4 4M2 13h12',
  paperclip: 'M11.5 7.5l-5 5a3 3 0 11-4.2-4.2l6-6a2 2 0 012.8 2.8l-6 6a1 1 0 11-1.4-1.4l5-5',
  send: 'M14 2L2 8l5 1.5L8.5 14z',
  home: 'M2 7l6-5 6 5v6a1 1 0 01-1 1h-3v-4H6v4H3a1 1 0 01-1-1z',
  settings: 'M8 5.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5zM13 8a5 5 0 00-.1-1.1l1.3-1-1-1.7-1.5.6a5 5 0 00-1.8-1L9.5 2H6.5l-.3 1.7a5 5 0 00-1.8 1l-1.5-.6-1 1.7 1.3 1A5 5 0 003 8c0 .4 0 .8.1 1.1l-1.3 1 1 1.7 1.5-.6a5 5 0 001.8 1L6.5 14h3l.3-1.8a5 5 0 001.8-1l1.5.6 1-1.7-1.3-1c.1-.3.2-.7.2-1.1z',
  zap: 'M9 1L3 9h4l-1 6 6-8H8z',
  shield: 'M8 1l5 2v5c0 3.5-2 5.5-5 7-3-1.5-5-3.5-5-7V3z',
  star: 'M8 1.5l2 4.5 5 .5-3.5 3 1 5L8 12l-4.5 2.5 1-5L1 6.5l5-.5z',
  shoppingBag: 'M3 5h10l-1 9H4zM6 5V3a2 2 0 014 0v2',
  trending: 'M2 11l4-4 3 3 5-5M9 5h4v4',
  clock: 'M8 4v4l3 2M8 14a6 6 0 100-12 6 6 0 000 12z',
  eye: 'M2 8s2-5 6-5 6 5 6 5-2 5-6 5-6-5-6-5zM8 10a2 2 0 100-4 2 2 0 000 4z',
  eyeOff: 'M2 2l12 12M6 6a2 2 0 002.8 2.8M9.6 9.6c-.5.3-1 .4-1.6.4-3 0-5-3-5-3a8.4 8.4 0 012-2.4M11 11c2-1 3-3 3-3s-2-3-5-3c-.5 0-1 0-1.5.2',
  trash: 'M3 5h10M6 5V3h4v2M5 5l1 9h4l1-9',
  edit: 'M2 14h12M12 2.5l1.5 1.5L6 11.5l-2 .5.5-2z',
  rupee: 'M5 3h6M5 6h6c0 1.5-1 2.5-3 2.5H5l4 4.5M5 6h2',
  copy: 'M5 5V3a1 1 0 011-1h7a1 1 0 011 1v7a1 1 0 01-1 1h-2M2 6a1 1 0 011-1h7a1 1 0 011 1v7a1 1 0 01-1 1H3a1 1 0 01-1-1z',
  refresh: 'M2 8a6 6 0 0110-4.5L13 5M14 8a6 6 0 01-10 4.5L3 11M13 2v3h-3M3 14v-3h3',
  filter: 'M2 3h12L9 9v5l-2-1V9z',
  calendar: 'M3 4h10v9H3zM3 7h10M6 2v3M10 2v3',
  image: 'M2 3h12v10H2zM2 10l3-3 3 3 2-2 3 3M5.5 6a1 1 0 100-2 1 1 0 000 2z',
  video: 'M2 4h8v8H2zM10 6l4-2v8l-4-2',
  type: 'M3 4h10M8 4v9M5 13h6',
  layers: 'M8 1L1 5l7 4 7-4zM1 9l7 4 7-4M1 12l7 4 7-4',
  radar: 'M8 8m-6 0a6 6 0 1012 0 6 6 0 10-12 0M8 8m-3 0a3 3 0 106 0 3 3 0 10-6 0M8 8l4-4',
  lock: 'M4 7V5a4 4 0 018 0v2M3 7h10v6H3z',
  download: 'M8 2v9M4 7l4 4 4-4M2 14h12',
  more: 'M3 8h.01M8 8h.01M13 8h.01',
  facebook: 'M9 5h2V3H9a3 3 0 00-3 3v2H4v2h2v4h2v-4h2.4l.6-2H8V6c0-.6.4-1 1-1z',
  instagram: 'M4 2h8a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V4a2 2 0 012-2zM8 5.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5zM12 4v.01',
  youtube: 'M2 5a2 2 0 012-2h8a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2zM7 6v4l3.5-2z',
  whatsapp: 'M2.5 13.5l1-3a5.5 5.5 0 111.5 1.5zM6 7a1 1 0 001 1l1 1a1 1 0 001 1l1-1c.3-.3.3-.7 0-1l-1-.5c-.3 0-.7 0-.9.2',
  microphone: 'M8 2a2 2 0 00-2 2v4a2 2 0 104 0V4a2 2 0 00-2-2zM4 8a4 4 0 008 0M8 12v2',
};

function Icon({ name, className = "", size = 14, strokeWidth = 1.6 }) {
  const d = I[name];
  if (!d) return null;
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

// Status chip — keyed on job status
function StatusChip({ status, dot = true }) {
  const meta = window.MM.STATUS_META[status] || { label: status, tone: "neutral" };
  return (
    <span className={`badge ${meta.tone}`}>
      {dot && <span className="bdot"></span>}
      {meta.label}
    </span>
  );
}

function Avatar({ name, initials, size = "md" }) {
  const init = initials || (name || "").split(" ").map(p => p[0]).slice(0, 2).join("");
  const cls = size === "lg" ? "avatar lg" : size === "sm" ? "avatar sm" : "avatar";
  return <div className={cls}>{init}</div>;
}

// Format INR
function rupee(n, opts = {}) {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString("en-IN");
  return `${sign}₹${formatted}${opts.decimals ? ".00" : ""}`;
}

// Toast host
function ToastHost({ toasts }) {
  return (
    <div className="toast-host">
      {toasts.map(t => (
        <div className="toast" key={t.id}>
          <div className="toast-icon" style={{ background: t.tone === "amber" ? "var(--amber)" : "var(--mint-500)" }}>
            <Icon name={t.icon || "check"} size={11} strokeWidth={2.4} />
          </div>
          <div>
            <div style={{ fontWeight: 500 }}>{t.title}</div>
            {t.body && <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.7)", marginTop: 2 }}>{t.body}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

// Modal
function Modal({ title, subtitle, children, onClose, footer, maxWidth }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: maxWidth || 480 }} onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h2>{title}</h2>
            {subtitle && <div className="subtitle">{subtitle}</div>}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="x" size={14} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

// Tabs
function Tabs({ items, value, onChange }) {
  return (
    <div className="tabs">
      {items.map(it => (
        <button key={it.value} className={`tab ${value === it.value ? "active" : ""}`} onClick={() => onChange(it.value)}>
          {it.label}
          {typeof it.count !== "undefined" && <span className="pill">{it.count}</span>}
        </button>
      ))}
    </div>
  );
}

// Toggle
function Toggle({ on, onChange }) {
  return <button className={`toggle ${on ? "on" : ""}`} onClick={() => onChange(!on)} aria-pressed={on}></button>;
}

// Checkbox
function Check({ on, onChange }) {
  return (
    <button className={`check ${on ? "on" : ""}`} onClick={() => onChange(!on)}>
      {on && <Icon name="check" size={10} strokeWidth={3} />}
    </button>
  );
}

// Expose globally for other JSX modules
Object.assign(window, {
  Icon, StatusChip, Avatar, rupee, ToastHost, Modal, Tabs, Toggle, Check
});
