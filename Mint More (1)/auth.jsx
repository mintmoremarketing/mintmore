// Auth — login + register on a split-screen with a deep ink aside.

function AuthScreen({ onSignIn, isMobile }) {
  const [mode, setMode] = React.useState("login");
  const [email, setEmail] = React.useState("priya@tilakweaves.in");
  const [password, setPassword] = React.useState("••••••••");
  const [showPw, setShowPw] = React.useState(false);
  const [role, setRole] = React.useState("client");
  const [loading, setLoading] = React.useState(false);

  function submit(e) {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => { setLoading(false); onSignIn(); }, 900);
  }

  return (
    <div className={`auth-shell ${isMobile ? "mobile" : ""}`}>
      <aside className="auth-aside">
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em" }}>
            Mint<span style={{ color: "var(--mint-400)", fontStyle: "italic", fontWeight: 500 }}>more</span>
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>
            Creative services for Indian businesses
          </div>
        </div>

        <div>
          <div className="brand-cubes">
            <div className="cube"></div>
            <div className="cube fill-mint"></div>
            <div className="cube"></div>
            <div className="cube fill-mint-dark"></div>
            <div className="cube fill-white"></div>
            <div className="cube fill-mint"></div>
            <div className="cube"></div>
            <div className="cube fill-mint"></div>
            <div className="cube"></div>
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 32, fontWeight: 500, lineHeight: 1.15, letterSpacing: "-0.02em", color: "white", maxWidth: 420 }}>
            Post a brief.{" "}
            <span style={{ color: "var(--mint-400)", fontStyle: "italic" }}>We find the right creative.</span>
          </div>
          <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 13.5, lineHeight: 1.6, maxWidth: 380, marginTop: 14 }}>
            Matched video, photography, social and branding talent — vetted, with escrow protection, deals approved before payout.
          </p>
        </div>

        <div style={{ display: "flex", gap: 14, alignItems: "center", color: "rgba(255,255,255,0.45)", fontSize: 11.5 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Icon name="shield" size={12} /> Escrow-secured
          </span>
          <span>·</span>
          <span>2,400+ verified creatives</span>
          <span>·</span>
          <span style={{ fontFamily: "var(--font-mono)" }}>4.92 ★</span>
        </div>
      </aside>

      <div className="auth-form-wrap">
        <form className="auth-form" onSubmit={submit}>
          {isMobile && (
            <div style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 600, letterSpacing: "-0.02em", marginBottom: 28 }}>
              Mint<span style={{ color: "var(--mint-700)", fontStyle: "italic", fontWeight: 500 }}>more</span>
            </div>
          )}
          <div className="h-eyebrow" style={{ marginBottom: 6 }}>{mode === "login" ? "Welcome back" : "Get started"}</div>
          <h1 className="h-display h-1" style={{ marginTop: 0, marginBottom: 6 }}>
            {mode === "login" ? "Sign in to your studio" : "Create your account"}
          </h1>
          <p className="muted" style={{ fontSize: 13.5, marginBottom: 26 }}>
            {mode === "login"
              ? "Pick up where you left off."
              : "Free to join. Pay only when you commission work."}
          </p>

          {mode === "register" && (
            <>
              <div className="grid-2" style={{ marginBottom: 12 }}>
                <button type="button" className={`role-card ${role === "client" ? "on" : ""}`} onClick={() => setRole("client")}>
                  <Icon name="shoppingBag" />
                  <span className="role-title">I'm a client</span>
                  <span className="role-sub">Hire creatives, run campaigns</span>
                </button>
                <button type="button" className={`role-card ${role === "freelancer" ? "on" : ""}`} onClick={() => setRole("freelancer")}>
                  <Icon name="zap" />
                  <span className="role-title">I'm a freelancer</span>
                  <span className="role-sub">Get matched, get paid</span>
                </button>
              </div>
              <div className="field" style={{ marginBottom: 12 }}>
                <label className="field-label">Full name</label>
                <input className="input" placeholder="Priya Sharma" />
              </div>
            </>
          )}

          <div className="field" style={{ marginBottom: 12 }}>
            <label className="field-label">Email</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="you@example.com"
            />
          </div>

          <div className="field" style={{ marginBottom: 6 }}>
            <div className="row between">
              <label className="field-label">Password</label>
              {mode === "login" && (
                <button type="button" className="btn link sm" style={{ padding: 0, fontSize: 11.5 }}>
                  Forgot?
                </button>
              )}
            </div>
            <div style={{ position: "relative" }}>
              <input
                className="input"
                type={showPw ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={{ paddingRight: 38 }}
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                style={{ position: "absolute", right: 8, top: 8, background: "transparent", border: 0, color: "var(--ink-500)", padding: 4 }}
              >
                <Icon name={showPw ? "eyeOff" : "eye"} />
              </button>
            </div>
          </div>

          {mode === "register" && (
            <div className="row" style={{ gap: 8, alignItems: "flex-start", marginTop: 16, marginBottom: 8 }}>
              <Check on={true} onChange={() => {}} />
              <span style={{ fontSize: 12, color: "var(--ink-600)", lineHeight: 1.5 }}>
                I agree to the{" "}
                <a href="#" style={{ color: "var(--ink-900)", textDecoration: "underline" }}>Terms</a>{" "}
                and{" "}
                <a href="#" style={{ color: "var(--ink-900)", textDecoration: "underline" }}>Privacy Policy</a>.
              </span>
            </div>
          )}

          <button type="submit" className="btn primary block lg" style={{ marginTop: 22 }} disabled={loading}>
            {loading ? (
              <>
                <span className="typing-dots" style={{ marginLeft: -4 }}>
                  <span style={{ background: "white" }}></span>
                  <span style={{ background: "white" }}></span>
                  <span style={{ background: "white" }}></span>
                </span>
                Signing you in
              </>
            ) : (
              <>
                {mode === "login" ? "Sign in" : "Create account"}
                <Icon name="arrowRight" />
              </>
            )}
          </button>

          <div style={{ marginTop: 22, fontSize: 13, color: "var(--ink-500)", textAlign: "center" }}>
            {mode === "login" ? (
              <>
                New here?{" "}
                <button type="button" className="btn link" style={{ padding: 0, fontSize: 13, color: "var(--ink-950)", fontWeight: 500, textDecoration: "underline" }} onClick={() => setMode("register")}>
                  Create an account
                </button>
              </>
            ) : (
              <>
                Already with us?{" "}
                <button type="button" className="btn link" style={{ padding: 0, fontSize: 13, color: "var(--ink-950)", fontWeight: 500, textDecoration: "underline" }} onClick={() => setMode("login")}>
                  Sign in
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

Object.assign(window, { AuthScreen });
