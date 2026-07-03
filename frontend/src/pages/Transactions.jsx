import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Search } from "lucide-react";

const normalize = (value) => String(value || "").trim().toLowerCase();

export function getVisibleTransactions(rows, uploadedOrderIds = []) {
  const ids = (uploadedOrderIds || [])
    .map((id) => String(id).trim())
    .filter(Boolean);

  return ids.length ? rows.filter((row) => ids.includes(String(row.order_id))) : rows;
}

export function filterTransactions(rows, uploadedOrderIds = [], actionFilter = "", searchTerm = "") {
  let filtered = getVisibleTransactions(rows, uploadedOrderIds);

  if (actionFilter) {
    filtered = filtered.filter((row) => row.action === actionFilter);
  }

  const query = normalize(searchTerm);
  if (!query) return filtered;

  return filtered.filter((row) => {
    const amountValue = row.amount != null ? String(row.amount) : "";
    const fields = [
      row.order_id,
      row.customer_id,
      amountValue,
      row.country,
      row.device,
      row.action,
    ];

    return fields.some((value) => normalize(value).includes(query));
  });
}

function formatInr(value) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return `₹${Number(value).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} INR`;
}

export default function Transactions() {
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const [active, setActive] = useState(null);
  const [showUploadedOnly, setShowUploadedOnly] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem("showUploadedOnly") === "true";
    } catch {
      return false;
    }
  });
  const [uploadedOrderIds, setUploadedOrderIds] = useState(() => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(localStorage.getItem("uploadedOrderIds") || "[]");
    } catch {
      return [];
    }
  });

  const load = useCallback(async () => {
    try {
      const data = await api.listTransactions({ limit: 200, action: filter || undefined });
      setRows(data);
    } catch { toast.error("Failed to load transactions"); }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const storedIds = JSON.parse(localStorage.getItem("uploadedOrderIds") || "[]");
      setUploadedOrderIds(storedIds);
      setShowUploadedOnly(localStorage.getItem("showUploadedOnly") === "true");
    } catch {
      setUploadedOrderIds([]);
      setShowUploadedOnly(false);
    }
  }, []);

  const open = (r) => { setActive(r); };
  const visibleRows = filterTransactions(rows, showUploadedOnly ? uploadedOrderIds : [], filter, search);

  return (
    <div className="page-shell" data-testid="transactions-page">
      <h1 className="page-title">Transactions</h1>
      <p className="page-sub">Most recent 200 scored transactions, filterable by decision and searchable by any field.</p>

      <div style={{ display: "flex", gap: ".75rem", marginBottom: "1rem", flexWrap: "wrap", alignItems: "center" }}>
        <input
          className="input"
          style={{ flex: 1, minWidth: 260 }}
          placeholder="Search order, customer, amount, country, device"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          data-testid="transactions-search"
        />
        <button
          className={uploadedOrderIds.length > 0 ? (showUploadedOnly ? "btn" : "btn ghost") : "btn ghost"}
          disabled={uploadedOrderIds.length === 0}
          onClick={() => {
            const next = !showUploadedOnly;
            setShowUploadedOnly(next);
            if (typeof window !== "undefined") {
              localStorage.setItem("showUploadedOnly", next ? "true" : "false");
            }
          }}
          data-testid="filter-uploaded"
        >
          {uploadedOrderIds.length > 0
            ? showUploadedOnly
              ? `Showing ${uploadedOrderIds.length} uploaded` 
              : `Show ${uploadedOrderIds.length} uploaded`
            : "No uploaded transactions"}
        </button>
      </div>

      <div style={{ display: "flex", gap: ".75rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        {["", "APPROVE", "REVIEW", "BLOCK"].map((a) => (
          <button
            key={a || "all"}
            className={filter === a ? "btn" : "btn ghost"}
            onClick={() => setFilter(a)}
            data-testid={`filter-${a || "all"}`}
          >
            {a || "All"}
          </button>
        ))}
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Order</th><th>Customer</th><th>Amount</th><th>Country</th><th>Device</th><th>Score</th><th>Action</th><th></th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((r) => (
              <tr key={r.id} data-testid={`tx-row-${r.order_id}`}>
                <td><strong>{r.order_id}</strong></td>
                <td>{r.customer_id}</td>
                <td>{formatInr(r.amount)}</td>
                <td>{r.country}</td>
                <td>{r.device}</td>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: ".5rem", minWidth: 120 }}>
                    <span style={{ fontWeight: 800 }}>{r.risk_score}</span>
                    <div className="risk-meter" style={{ flex: 1 }}>
                      <div className={`fill ${r.action.toLowerCase()}`} style={{ width: `${r.risk_score}%` }} />
                    </div>
                  </div>
                </td>
                <td><span className={`pill ${r.action.toLowerCase()}`}>{r.action}</span></td>
                <td><button className="btn ghost sm" onClick={() => open(r)} data-testid={`tx-view-${r.order_id}`}><Search size={12} /> View</button></td>
              </tr>
            ))}
            {!visibleRows.length && <tr><td colSpan={8} style={{ textAlign: "center", color: "#94a3b8", padding: "2rem" }}>No transactions yet</td></tr>}
          </tbody>
        </table>
      </div>

      {active && (
        <div style={overlay} onClick={() => setActive(null)}>
          <div className="card" style={modal} onClick={(e) => e.stopPropagation()} data-testid="tx-modal">
            <h3 style={{ fontSize: "1.2rem", fontWeight: 800, marginBottom: ".5rem" }}>{active.order_id}</h3>
            <div style={{ color: "#64748b", marginBottom: "1rem" }}>
              {active.country} · {active.device} · {formatInr(active.amount)}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: ".75rem", marginBottom: "1rem" }}>
              <Tile k="Risk Score" v={active.risk_score} />
              <Tile k="Action" v={<span className={`pill ${active.action.toLowerCase()}`}>{active.action}</span>} />
              <Tile k="Rule Score" v={active.rule_score} />
              <Tile k="Velocity / Device / Geo" v={`${active.velocity_score} / ${active.device_score} / ${active.geo_score}`} />
              <Tile k="ML Probability" v={active.ml_probability != null ? `${(active.ml_probability * 100).toFixed(1)}%` : "—"} />
              <Tile k="Customer" v={active.customer_id || "—"} />
            </div>

            <h4 style={{ fontWeight: 700, marginBottom: ".5rem" }}>Triggered Signals</h4>
            <div style={{ display: "flex", gap: ".5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
              {(active.signals || []).map((s, i) => (
                <span key={i} className="pill review" data-testid={`tx-signal-${s.rule_name}`}>{s.rule_name} · {s.points}</span>
              ))}
              {!active.signals?.length && <span style={{ color: "#94a3b8" }}>No rules triggered</span>}
            </div>

            <div style={{ marginTop: "1rem", textAlign: "right" }}>
              <button className="btn ghost" onClick={() => setActive(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Tile({ k, v }) {
  return (
    <div style={{ background: "#f8fafc", borderRadius: 12, padding: ".75rem 1rem" }}>
      <div style={{ color: "#94a3b8", fontSize: ".7rem", letterSpacing: 1, textTransform: "uppercase" }}>{k}</div>
      <div style={{ fontWeight: 800, marginTop: ".15rem" }}>{v}</div>
    </div>
  );
}

const overlay = {
  position: "fixed", inset: 0, background: "rgba(15,23,42,.55)",
  display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: "1rem",
};
const modal = { width: "100%", maxWidth: 760, maxHeight: "90vh", overflow: "auto" };
