// Wallet — balance, escrow viz, transactions, top-up modal

function Wallet({ onTopUp, isMobile, pushToast }) {
  const [filter, setFilter] = React.useState("all");
  const txns = window.MM.TXNS.filter(t => filter === "all" ? true : t.type === filter);
  const total = window.MM.WALLET.available + window.MM.WALLET.escrow;

  return (
    <div className="stack-6">
      <div className="reveal" data-d="0">
        <div className="h-eyebrow" style={{ marginBottom: 4 }}>Wallet</div>
        <h1 className="h-display h-1" style={{ margin: 0 }}>Balance &amp; transactions</h1>
        <p className="muted" style={{ marginTop: 6 }}>Funds are escrow-secured. We hold them until delivery is approved.</p>
      </div>

      {/* Balance hero */}
      <div className={isMobile ? "stack" : ""} style={{ display: isMobile ? "flex" : "grid", gridTemplateColumns: isMobile ? undefined : "1.4fr 1fr", gap: 14 }}>
        <div className="card-ink reveal" data-d="1" style={{ position: "relative", overflow: "hidden", padding: 26 }}>
          <div style={{ position: "absolute", inset: 0,
            background: "radial-gradient(circle at 90% 10%, rgba(16, 185, 129, 0.18), transparent 50%)" }}></div>
          <div style={{ position: "relative" }}>
            <div className="row between" style={{ marginBottom: 14 }}>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: 0.04 }}>Total balance</span>
              <span className="badge mint" style={{ background: "rgba(16, 185, 129, 0.18)", border: "1px solid rgba(16, 185, 129, 0.3)", color: "var(--mint-200)" }}>
                <Icon name="shield" size={11} /> &nbsp;Escrow-secured
              </span>
            </div>
            <div className="row" style={{ alignItems: "baseline", gap: 10 }}>
              <span style={{ fontFamily: "var(--font-display)", fontSize: 48, fontWeight: 500, letterSpacing: "-0.02em", lineHeight: 1 }}>
                {rupee(total)}
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "rgba(255,255,255,0.5)" }}>.00</span>
            </div>

            {/* Split bar */}
            <div style={{ marginTop: 22 }}>
              <div className="split-bar">
                <div className="seg available" style={{ width: `${(window.MM.WALLET.available / total) * 100}%` }}></div>
                <div className="seg escrow" style={{ width: `${(window.MM.WALLET.escrow / total) * 100}%`, background: "rgba(255,255,255,0.6)" }}></div>
              </div>
              <div className="row between" style={{ marginTop: 12, fontSize: 12 }}>
                <div>
                  <div className="row" style={{ gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: "var(--mint-500)" }}></span>
                    <span style={{ color: "rgba(255,255,255,0.7)" }}>Available</span>
                  </div>
                  <div className="mono" style={{ color: "white", marginTop: 4, fontSize: 16, fontWeight: 500 }}>{rupee(window.MM.WALLET.available)}</div>
                </div>
                <div>
                  <div className="row" style={{ gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: "rgba(255,255,255,0.6)" }}></span>
                    <span style={{ color: "rgba(255,255,255,0.7)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                      Escrowed <Icon name="lock" size={10} />
                    </span>
                  </div>
                  <div className="mono" style={{ color: "white", marginTop: 4, fontSize: 16, fontWeight: 500 }}>{rupee(window.MM.WALLET.escrow)}</div>
                </div>
                <div>
                  <div style={{ color: "rgba(255,255,255,0.7)" }}>Spent · 30d</div>
                  <div className="mono" style={{ color: "white", marginTop: 4, fontSize: 16, fontWeight: 500 }}>{rupee(67611)}</div>
                </div>
              </div>
            </div>

            <div className="row" style={{ marginTop: 22, gap: 8 }}>
              <button className="btn mint" onClick={onTopUp}>
                <Icon name="plus" /> Top up wallet
              </button>
              <button className="btn link" style={{ color: "rgba(255,255,255,0.85)" }}>
                Download statement <Icon name="download" size={12} />
              </button>
            </div>
          </div>
        </div>

        {/* Escrow breakdown */}
        <div className="card reveal" data-d="2" style={{ padding: 18 }}>
          <div className="row between" style={{ marginBottom: 12 }}>
            <h3 className="h-display h-3" style={{ margin: 0 }}>What's in escrow</h3>
            <span className="badge neutral">{window.MM.ESCROW_BREAKDOWN.length} active</span>
          </div>
          <div className="stack" style={{ gap: 10 }}>
            {window.MM.ESCROW_BREAKDOWN.map((e, i) => (
              <div key={i} style={{ padding: "12px 14px", background: "var(--paper-tint)", borderRadius: "var(--radius-md)", border: "1px solid var(--hairline)" }}>
                <div className="row between" style={{ marginBottom: 6 }}>
                  <span className="mono" style={{ fontSize: 15, fontWeight: 500, color: "var(--ink-950)" }}>{rupee(e.amount)}</span>
                  <StatusChip status={e.status} />
                </div>
                <div style={{ fontSize: 12.5, color: "var(--ink-700)", fontWeight: 500, lineHeight: 1.35 }}>{e.job}</div>
                <div style={{ fontSize: 11.5, color: "var(--ink-500)", marginTop: 2 }}>Held for {e.freelancer}</div>
              </div>
            ))}
            <div style={{ padding: "10px 12px", borderRadius: "var(--radius-md)", border: "1px dashed var(--hairline-strong)", fontSize: 12, color: "var(--ink-500)", textAlign: "center" }}>
              <Icon name="shield" size={11} /> &nbsp;Released to creatives only on your approval
            </div>
          </div>
        </div>
      </div>

      {/* Transactions */}
      <div className="stack reveal" data-d="3">
        <div className="row between" style={{ flexWrap: "wrap", gap: 10 }}>
          <h2 className="h-display h-3" style={{ margin: 0 }}>Transactions</h2>
          <div className="row" style={{ gap: 8 }}>
            <Tabs
              value={filter}
              onChange={setFilter}
              items={[
                { value: "all",     label: "All" },
                { value: "topup",   label: "Top-ups" },
                { value: "escrow",  label: "Escrow" },
                { value: "release", label: "Releases" },
                { value: "ai",      label: "AI usage" },
              ]}
            />
            <button className="btn ghost sm"><Icon name="download" /> Export</button>
          </div>
        </div>

        <div className="card-flat">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--paper-tint)", borderBottom: "1px solid var(--hairline)" }}>
                <Th>Date</Th>
                <Th>Type</Th>
                <Th>Description</Th>
                <Th align="right">Amount</Th>
                <Th align="right">Balance after</Th>
              </tr>
            </thead>
            <tbody>
              {txns.map((t, i) => (
                <tr key={t.id} style={{ borderBottom: i === txns.length - 1 ? "0" : "1px solid var(--hairline)" }}>
                  <Td><span className="mono" style={{ color: "var(--ink-700)" }}>{t.date}</span></Td>
                  <Td><TxnBadge type={t.type} /></Td>
                  <Td>{t.desc}</Td>
                  <Td align="right">
                    <span className="mono" style={{ color: t.amt >= 0 ? "var(--mint-700)" : "var(--ink-950)", fontWeight: 500 }}>
                      {t.amt >= 0 ? "+" : ""}{rupee(t.amt)}
                    </span>
                  </Td>
                  <Td align="right"><span className="mono muted">{rupee(t.balance)}</span></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="row between" style={{ fontSize: 12, color: "var(--ink-500)", marginTop: 4 }}>
          <span>Showing {txns.length} of {window.MM.TXNS.length}</span>
          <span className="mono">Last sync · 2 min ago</span>
        </div>
      </div>
    </div>
  );
}

function Th({ children, align }) {
  return <th style={{ padding: "10px 14px", fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.04, color: "var(--ink-500)", textAlign: align || "left" }}>{children}</th>;
}
function Td({ children, align }) {
  return <td style={{ padding: "12px 14px", fontSize: 13, color: "var(--ink-800)", textAlign: align || "left", verticalAlign: "middle" }}>{children}</td>;
}

function TxnBadge({ type }) {
  const map = {
    topup:   { label: "Top-up",   tone: "mint" },
    escrow:  { label: "Escrow",   tone: "violet" },
    release: { label: "Release",  tone: "sky" },
    ai:      { label: "Mint AI",  tone: "neutral" },
    addon:   { label: "Add-on",   tone: "amber" },
  };
  const m = map[type] || map.ai;
  return <span className={`badge ${m.tone}`}><span className="bdot"></span> {m.label}</span>;
}

// Top-up modal
function TopUpModal({ onClose, pushToast }) {
  const presets = [500, 1000, 2000, 5000, 10000, 25000];
  const [amount, setAmount] = React.useState(5000);
  const [stage, setStage] = React.useState("input"); // input | razorpay | success
  const fee = Math.round(amount * 0.02);

  function pay() {
    setStage("razorpay");
    setTimeout(() => setStage("success"), 1800);
    setTimeout(() => {
      onClose();
      pushToast({ title: "Wallet topped up", body: `${rupee(amount)} added · new balance ₹${(window.MM.WALLET.available + amount).toLocaleString("en-IN")}` });
      window.MM.WALLET.available += amount;
    }, 3400);
  }

  return (
    <Modal title="Top up wallet" subtitle="Funds clear instantly via Razorpay. Available for jobs immediately." onClose={onClose} maxWidth={460}
      footer={stage === "input" && (
        <>
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={pay}>
            Proceed to pay <Icon name="arrowRight" />
          </button>
        </>
      )}
    >
      {stage === "input" && (
        <>
          <div className="field">
            <label className="field-label">Amount</label>
            <div className="input-with-prefix">
              <span className="prefix">₹</span>
              <input className="input input-mono" type="number" value={amount} onChange={e => setAmount(parseInt(e.target.value || 0))} style={{ fontSize: 18, fontWeight: 500 }} />
            </div>
          </div>
          <div className="row wrap" style={{ marginTop: 10, gap: 6 }}>
            {presets.map(p => (
              <button key={p} onClick={() => setAmount(p)} className={`btn sm ${amount === p ? "primary" : "ghost"}`} style={{ fontFamily: "var(--font-mono)" }}>
                ₹{p.toLocaleString("en-IN")}
              </button>
            ))}
          </div>
          <div style={{ marginTop: 18, padding: 12, background: "var(--paper-tint)", borderRadius: "var(--radius-md)", border: "1px solid var(--hairline)" }}>
            <div className="row between" style={{ fontSize: 13 }}>
              <span className="muted">Amount</span>
              <span className="mono">{rupee(amount)}</span>
            </div>
            <div className="row between" style={{ fontSize: 13, marginTop: 6 }}>
              <span className="muted">Razorpay fee (2%)</span>
              <span className="mono">{rupee(fee)}</span>
            </div>
            <div style={{ height: 1, background: "var(--hairline)", margin: "10px 0" }}></div>
            <div className="row between" style={{ fontSize: 14 }}>
              <span style={{ fontWeight: 500 }}>You pay</span>
              <span className="mono" style={{ fontWeight: 600, color: "var(--ink-950)" }}>{rupee(amount + fee)}</span>
            </div>
          </div>
          <div className="row" style={{ marginTop: 12, gap: 6, fontSize: 11.5, color: "var(--ink-500)" }}>
            <Icon name="shield" size={11} /> Secured by Razorpay · UPI, cards, netbanking
          </div>
        </>
      )}
      {stage === "razorpay" && (
        <div style={{ padding: "40px 20px", textAlign: "center" }}>
          <div className="radar-wrap" style={{ width: 120, height: 120 }}>
            <div className="radar-pulse" style={{ width: 50, height: 50 }}></div>
            <div className="radar-pulse" style={{ width: 50, height: 50 }}></div>
            <div className="radar-core" style={{ width: 48, height: 48 }}>
              <Icon name="shield" size={18} strokeWidth={2} />
            </div>
          </div>
          <h3 className="h-display h-3" style={{ marginTop: 24, marginBottom: 6 }}>Connecting to Razorpay</h3>
          <p className="muted" style={{ fontSize: 13 }}>You'll be redirected to complete payment.</p>
        </div>
      )}
      {stage === "success" && (
        <div style={{ padding: "32px 20px", textAlign: "center" }}>
          <div style={{ width: 60, height: 60, borderRadius: "50%", background: "var(--mint-100)", color: "var(--mint-700)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
            <Icon name="check" size={28} strokeWidth={2.5} />
          </div>
          <h3 className="h-display h-2" style={{ margin: "0 0 6px" }}>{rupee(amount)} added</h3>
          <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>Available for jobs immediately.</p>
          <div style={{ background: "var(--paper-tint)", border: "1px solid var(--hairline)", borderRadius: "var(--radius-md)", padding: 12, display: "inline-flex", flexDirection: "column", gap: 4 }}>
            <span className="muted" style={{ fontSize: 11 }}>New balance</span>
            <span className="mono" style={{ fontSize: 22, fontWeight: 600, color: "var(--ink-950)" }}>
              {rupee(window.MM.WALLET.available + amount)}
            </span>
          </div>
        </div>
      )}
    </Modal>
  );
}

Object.assign(window, { Wallet, TopUpModal });
