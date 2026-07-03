import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Upload, Send } from "lucide-react";

const SAMPLE_JSON = JSON.stringify({
  order_id: "ORD-DEMO-001",
  customer_id: "CUS-42",
  amount: 1500,
  order_value: 1500,
  currency: "INR",
  device: "android",
  device_id: "DEV-99",
  country: "India",
  hour: 2,
  failed_payments: 3,
  vpn: true,
  cross_border: false,
  device_age_days: 3,
  customer: { order_count: 0, return_ratio: 0.7 },
  geo: { lat: 28.61, lon: 77.21 }
}, null, 2);

export default function CheckFraud() {
  const [jsonText, setJsonText] = useState(SAMPLE_JSON);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [batch, setBatch] = useState(null);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef(null);
  const navigate = useNavigate();

  const runJson = async () => {
    setBusy(true);
    setResult(null); setBatch(null);
    try {
      const order = JSON.parse(jsonText);
      const res = await api.checkFraud(order);
      setResult(res);
    } catch (e) {
      toast.error(e?.message || "Failed to parse / score");
    } finally { setBusy(false); }
  };

  const onFile = async (file) => {
    if (!file) return;
    setBusy(true); setBatch(null); setResult(null);
    try {
      const res = await api.checkFraudUpload(file);
      setBatch(res);
      toast.success(`Scored ${res.summary.total} transactions`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Upload failed");
    } finally { setBusy(false); }
  };

  const onDrop = (e) => {
    e.preventDefault(); setDrag(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onFile(f);
  };

  const openUploadedTransactions = () => {
    if (!batch?.items?.length) return;
    const uploadedOrderIds = batch.items
      .map((item) => item?.transaction?.order_id)
      .filter(Boolean);

    if (uploadedOrderIds.length) {
      localStorage.setItem("uploadedOrderIds", JSON.stringify(uploadedOrderIds));
      localStorage.setItem("showUploadedOnly", "true");
    }

    navigate("/transactions");
  };

  function formatInr(value) {
    if (value == null || Number.isNaN(Number(value))) return "—";
    return `₹${Number(value).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} INR`;
  }

  return (
    <div className="page-shell" data-testid="check-page">
      <h1 className="page-title">Live Fraud Check</h1>
      <p className="page-sub">Score a single transaction by pasting JSON, or upload a JSON/XML batch.</p>

      <div className="chart-grid-2" style={{ marginTop: "1rem" }}>
        {/* JSON input */}
        <div className="card" data-testid="json-input-card">
          <h3>Single Transaction (JSON)</h3>
          <textarea
            className="textarea"
            style={{ minHeight: 320 }}
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            data-testid="json-input"
          />
          <div style={{ display: "flex", gap: ".75rem", marginTop: ".75rem" }}>
            <button className="btn" onClick={runJson} disabled={busy} data-testid="run-check-btn">
              <Send size={14} /> {busy ? "Scoring…" : "Score Transaction"}
            </button>
            <button className="btn ghost" onClick={() => setJsonText(SAMPLE_JSON)}>Reset Sample</button>
          </div>
        </div>

        {/* File upload */}
        <div className="card" data-testid="upload-card">
          <h3>Batch Upload (JSON / XML)</h3>
          <div
            className={`dropzone ${drag ? "drag" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            data-testid="dropzone"
          >
            <Upload size={28} style={{ marginBottom: ".5rem" }} />
            <div style={{ fontWeight: 700, color: "#1e293b" }}>Drop a .json or .xml file</div>
            <div style={{ fontSize: ".85rem", marginTop: ".25rem" }}>Or click to browse</div>
            <input
              ref={fileRef}
              type="file"
              accept=".json,.xml,application/json,application/xml,text/xml"
              hidden
              onChange={(e) => onFile(e.target.files?.[0])}
              data-testid="file-input"
            />
          </div>
          <div style={{ fontSize: ".82rem", color: "#64748b", marginTop: ".75rem" }}>
            JSON: array of orders or <code>{`{ "orders": [...] }`}</code>. XML: <code>{`<orders><order>…</order></orders>`}</code>
          </div>
        </div>
      </div>

      {/* Single result */}
      {result && (
        <div className="card" style={{ marginTop: "1.5rem" }} data-testid="result-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
            <div>
              <h3>Decision · <span className={`pill ${result.result.action.toLowerCase()}`} data-testid="result-action">{result.result.action}</span></h3>
              <div style={{ color: "#64748b" }}>{result.transaction.order_id} · {result.transaction.country} · {formatInr(result.transaction.amount)}</div>
            </div>
            <div style={{ minWidth: 280, flex: 1, maxWidth: 420 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: ".25rem" }}>
                <span style={{ fontWeight: 700 }}>Risk Score</span>
                <span style={{ fontWeight: 800 }} data-testid="result-score">{result.result.risk_score}/100</span>
              </div>
              <div className="risk-meter"><div className={`fill ${result.result.action.toLowerCase()}`} style={{ width: `${result.result.risk_score}%` }} /></div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: ".75rem", marginTop: "1rem" }}>
            <Mini k="Rule Score" v={result.result.rule_score} />
            <Mini k="Velocity" v={result.result.velocity_score} />
            <Mini k="Device" v={result.result.device_score} />
            <Mini k="Geo" v={result.result.geo_score} />
          </div>

          <h4 style={{ marginTop: "1.25rem", marginBottom: ".5rem", fontWeight: 700 }}>Triggered Signals</h4>
          <div style={{ display: "flex", gap: ".5rem", flexWrap: "wrap" }}>
            {result.result.signals.map((s, i) => (
              <span key={i} className="pill review" data-testid={`signal-${s.rule_name}`}>{s.rule_name} · +{s.points}</span>
            ))}
            {!result.result.signals.length && <span style={{ color: "#94a3b8" }}>No rules triggered.</span>}
          </div>

          {result.result.ml_probability != null && (
            <div style={{ marginTop: "1rem", color: "#475569" }}>
              ML fraud probability: <strong>{(result.result.ml_probability * 100).toFixed(1)}%</strong> · blended at 60% rules / 40% ML.
            </div>
          )}

        </div>
      )}

      {/* Batch result */}
      {batch && (
        <div className="card" style={{ marginTop: "1.5rem" }} data-testid="batch-card">
          <h3>Batch Result</h3>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: ".75rem", margin: ".5rem 0 1.25rem", flexWrap: "wrap" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: ".75rem", flex: 1 }}>
              <Mini k="Total" v={batch.summary.total} />
              <Mini k="Approved" v={batch.summary.approved} />
              <Mini k="Review" v={batch.summary.review} />
              <Mini k="Blocked" v={batch.summary.blocked} />
            </div>
            <button className="btn" onClick={openUploadedTransactions} data-testid="view-uploaded-transactions-btn">
              View Uploaded Transactions
            </button>
          </div>
          <table className="table">
            <thead><tr><th>Order</th><th>Country</th><th>Score</th><th>Action</th><th>Signals</th></tr></thead>
            <tbody>
              {batch.items.map((it, i) => (
                <tr key={i} data-testid={`batch-row-${i}`}>
                  <td>{it.transaction.order_id}</td>
                  <td>{it.transaction.country || "—"}</td>
                  <td>{it.result.risk_score}</td>
                  <td><span className={`pill ${it.result.action.toLowerCase()}`}>{it.result.action}</span></td>
                  <td style={{ fontSize: ".8rem", color: "#64748b" }}>{(it.result.signals.map(s => s.rule_name).join(", ")) || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Mini({ k, v }) {
  return (
    <div style={{ background: "#f8fafc", borderRadius: 12, padding: ".75rem 1rem", textAlign: "center" }}>
      <div style={{ color: "#94a3b8", fontSize: ".7rem", letterSpacing: 1, textTransform: "uppercase" }}>{k}</div>
      <div style={{ fontWeight: 800, fontSize: "1.4rem", color: "#1e293b" }}>{v}</div>
    </div>
  );
}
