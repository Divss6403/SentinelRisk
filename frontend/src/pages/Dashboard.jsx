// Dashboard.jsx
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  Area, AreaChart, CartesianGrid, Tooltip, XAxis, YAxis, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, BarChart, Bar
} from "recharts";
import { Activity, Ban, CheckCircle2, AlertTriangle, RefreshCw, TrendingUp } from "lucide-react";
import { toast } from "sonner";

const fmt = (n) => new Intl.NumberFormat().format(n ?? 0);
const money = (n) => {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} INR`;
};

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [series, setSeries] = useState([]);
  const [dist, setDist] = useState([]);
  const [top, setTop] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [s, ts, d, t] = await Promise.all([
        api.stats(), api.timeseries(14), api.actionDistribution(), api.topRules()
      ]);
      setStats(s); setSeries(ts); setDist(d); setTop(t);
    } catch (e) {
      toast.error("Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const reseed = async () => {
    if (!window.confirm("Reset demo data? This wipes rules + transactions and reseeds.")) return;
    try {
      await api.reseed(true);
      toast.success("Demo data reseeded");
      load();
    } catch { toast.error("Reseed failed"); }
  };

  return (
    <div className="page-shell" data-testid="dashboard-page">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
        <div>
          <h1 className="page-title">Risk Operations Dashboard</h1>
          <p className="page-sub">Live signal mix, action breakdown and rule effectiveness across the last 14 days.</p>
        </div>
        <div style={{ display: "flex", gap: ".75rem" }}>
          <button className="btn ghost" onClick={load} data-testid="dashboard-refresh-btn">
            <RefreshCw size={14} /> Refresh
          </button>
          <button className="btn" onClick={reseed} data-testid="dashboard-reseed-btn">Reseed Demo</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="kpi-grid">
        <KPI label="Total Transactions" value={fmt(stats?.total_transactions)} icon={<Activity size={18}/>} sub={`${stats?.rules_count ?? 0} active rules`} testid="kpi-total" />
        <KPI label="Avg Risk Score" value={stats?.avg_risk_score ?? 0} icon={<TrendingUp size={18}/>} sub="last 500 evaluations" testid="kpi-avg" />
        <KPI label="Blocked" value={fmt(stats?.blocked)} icon={<Ban size={18}/>} sub={money(stats?.blocked_amount) + " value"} testid="kpi-blocked" />
        <KPI label="Fraud Rate" value={`${stats?.fraud_rate_pct ?? 0}%`} icon={<AlertTriangle size={18}/>} sub={`${stats?.review ?? 0} review · ${stats?.approved ?? 0} approve`} testid="kpi-rate" />
      </div>

      {/* Time series + action pie */}
      <div className="chart-grid">
        <div className="card" data-testid="card-timeseries">
          <h3>Transactions Over Time</h3>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series}>
                <defs>
                  <linearGradient id="gApprove" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#475569" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="#475569" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gReview" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gBlock" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.55} />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(71,85,105,.15)" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0" }} />
                <Area type="monotone" dataKey="APPROVE" stackId="1" stroke="#475569" fill="url(#gApprove)" />
                <Area type="monotone" dataKey="REVIEW" stackId="1" stroke="#f59e0b" fill="url(#gReview)" />
                <Area type="monotone" dataKey="BLOCK" stackId="1" stroke="#ef4444" fill="url(#gBlock)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card" data-testid="card-pie">
          <h3>Action Distribution</h3>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={dist} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={4}>
                  {dist.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top rules — full width */}
      <div className="card" data-testid="card-top-rules">
        <h3>Top Triggering Rules</h3>
        <div style={{ height: 360 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={top} layout="vertical" margin={{ left: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(71,85,105,.15)" />
              <XAxis type="number" stroke="#64748b" fontSize={12} />
              <YAxis dataKey="rule_name" type="category" stroke="#64748b" fontSize={11} width={200} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0" }} />
              <Bar dataKey="count" fill="#1e293b" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {loading && <div style={{ textAlign: "center", color: "#64748b", marginTop: "1.5rem" }}>Loading…</div>}
    </div>
  );
}

function KPI({ label, value, icon, sub, testid }) {
  return (
    <div className="kpi-card" data-testid={testid}>
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      <div className="sub">{sub}</div>
      <div className="accent">{icon}</div>
    </div>
  );
}
