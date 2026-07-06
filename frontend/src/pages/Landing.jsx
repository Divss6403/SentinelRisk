import { Link } from "react-router-dom";
import { ShieldCheck, Activity, GitBranch, Brain, Globe, FileSearch, Layers, Sparkles } from "lucide-react";

export default function Landing() {
  return (
    <>
      {/* HERO */}
      <section className="hero" id="home" data-testid="hero-section">
        <div className="geo-shapes">
          <div className="geo-shape" />
          <div className="geo-shape" />
          <div className="geo-shape" />
          <div className="geo-shape" />
          <div className="geo-shape" />
        </div>
        <div className="hero-inner">
          <h1 data-testid="hero-headline">Enterprise Fraud<br />Detection Redefined</h1>
          <p data-testid="hero-paragraph">
            A dynamic rule engine, velocity heuristics and ML scoring united in
            one real-time platform. Catch stolen-card, takeover and refund-abuse
            patterns before they hit your ledger.
          </p>
          <div className="cta-row">
            <Link to="/check" className="cta-button" data-testid="cta-check-fraud">Run a Live Check</Link>
            <Link to="/dashboard" className="cta-button ghost" data-testid="cta-dashboard">Open Dashboard</Link>
          </div>
          <div className="hero-stats">
            <div className="stat"><div className="v">3</div><div className="l">Detection Layers</div></div>
            <div className="stat"><div className="v">10+</div><div className="l">Default Rules</div></div>
            <div className="stat"><div className="v">60/40</div><div className="l">Rules / ML Blend</div></div>
            <div className="stat"><div className="v">&lt;200ms</div><div className="l">Scoring Latency</div></div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="section" id="capabilities">
        <div className="section-eyebrow">Capabilities</div>
        <h2 className="section-title">A Strategic Arsenal Against Fraud</h2>
        <div className="features-grid">
          <div className="feature-card" data-testid="feature-rules">
            <div className="ico"><GitBranch size={20} /></div>
            <h3>Dynamic Rule Engine</h3>
            <p>Author MongoDB-backed rules with the <code>rule_engine</code> grammar — ship a new policy in seconds, no redeploys.</p>
          </div>
          <div className="feature-card" data-testid="feature-velocity">
            <div className="ico"><Activity size={20} /></div>
            <h3>Velocity & Device Graphs</h3>
            <p>Detect bursts of activity, device fingerprint overlap and account-takeover signals across a sliding window.</p>
          </div>
          <div className="feature-card" data-testid="feature-geo">
            <div className="ico"><Globe size={20} /></div>
            <h3>Impossible Travel</h3>
            <p>Haversine-based geo scoring flags transactions whose implied speed exceeds 800 km/h between events.</p>
          </div>
          <div className="feature-card" data-testid="feature-ml">
            <div className="ico"><Brain size={20} /></div>
            <h3>Hybrid ML Scoring</h3>
            <p>Random-Forest fraud probability blended with rule output at a 60/40 ratio — explainable + statistically robust.</p>
          </div>
          <div className="feature-card" data-testid="feature-files">
            <div className="ico"><FileSearch size={20} /></div>
            <h3>JSON &amp; XML Ingestion</h3>
            <p>Drop a JSON or XML batch file — the platform parses, scores and stores every transaction in one pass.</p>
          </div>
          <div className="feature-card" data-testid="feature-signals">
            <div className="ico"><Sparkles size={20} /></div>
            <h3>Signal Transparency</h3>
            <p>Every decision includes clear signal context so analysts can triage alerts with confidence.</p>
          </div>
        </div>
      </section>

      {/* THREE LEVELS */}
      <section className="dark-band">
        <div className="section">
          <div className="section-eyebrow" style={{ color: "#94a3b8" }}>Architecture</div>
          <h2 className="section-title">Three Levels of Detection</h2>
          <div className="level-stack">
            <div className="level-card" data-testid="level-card-1">
              <span className="badge">Level 1 · MVP</span>
              <h3>Rule Engine</h3>
              <p>Sum of points triggered by every rule whose condition evaluates true against the transaction.</p>
              <ul>
                <li>rule_engine grammar</li>
                <li>MongoDB-stored rules</li>
                <li>O(rules) per transaction</li>
              </ul>
            </div>
            <div className="level-card" data-testid="level-card-2">
              <span className="badge">Level 2 · Heuristic</span>
              <h3>+ Velocity, Device, Geo</h3>
              <p>Adds 1-minute velocity, multi-account-per-device and impossible-travel scoring on top of rule output.</p>
              <ul>
                <li>Velocity window</li>
                <li>Device → accounts graph</li>
                <li>Haversine geo speed</li>
              </ul>
            </div>
            <div className="level-card" data-testid="level-card-3">
              <span className="badge">Level 3 · Hybrid</span>
              <h3>+ ML</h3>
              <p>RandomForest probability blended 60/40 with rule output, plus decision context and signal transparency.</p>
              <ul>
                <li>RandomForestClassifier</li>
                <li>0.6 · rules + 0.4 · ML</li>
                <li>Audit-ready signal breakdown</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ACTION TIER */}
      <section className="section" id="tiers">
        <div className="section-eyebrow">Decision Manager</div>
        <h2 className="section-title">From Score to Action — Instantly</h2>
        <div className="features-grid">
          <div className="feature-card" style={{ borderTop: "4px solid var(--risk-approve)" }} data-testid="tier-approve">
            <div className="ico" style={{ background: "linear-gradient(135deg,#10b981,#059669)" }}><ShieldCheck size={20} /></div>
            <h3>0 – 30 · Approve</h3>
            <p>Frictionless settlement. Transaction stored with full signal breakdown for forensic replay.</p>
          </div>
          <div className="feature-card" style={{ borderTop: "4px solid var(--risk-review)" }} data-testid="tier-review">
            <div className="ico" style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)" }}><Layers size={20} /></div>
            <h3>31 – 60 · Review</h3>
            <p>Routed to an analyst queue with the triggered signals and decision context attached to the case.</p>
          </div>
          <div className="feature-card" style={{ borderTop: "4px solid var(--risk-block)" }} data-testid="tier-block">
            <div className="ico" style={{ background: "linear-gradient(135deg,#ef4444,#dc2626)" }}><ShieldCheck size={20} /></div>
            <h3>61 – 100 · Block</h3>
            <p>Hard decline. Customer, device and IP added to short-term watch caches for downstream services.</p>
          </div>
        </div>
      </section>

      <footer className="footer" data-testid="footer">
        <div>SentinelRisk · Enterprise Fraud Detection &amp; Risk Scoring Platform</div>
        <div style={{ opacity: .6, marginTop: ".5rem" }}>Powered by FastAPI · MongoDB · rule_engine · scikit-learn</div>
      </footer>
    </>
  );
}
