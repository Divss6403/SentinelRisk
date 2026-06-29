// RuleManager.jsx
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, X, Check } from "lucide-react";

const SAMPLE_CONDITION = "order_value > 1000 and customer.order_count == 0";

export default function RuleManager() {
  const [rules, setRules] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", condition: SAMPLE_CONDITION, points: 30, description: "", enabled: true });
  const [validating, setValidating] = useState(false);
  const [valid, setValid] = useState(null);

  const load = async () => {
    try { setRules(await api.listRules()); }
    catch { toast.error("Failed to load rules"); }
  };
  useEffect(() => { load(); }, []);

  const startCreate = () => {
    setEditing(null);
    setForm({ name: "", condition: SAMPLE_CONDITION, points: 30, description: "", enabled: true });
    setValid(null);
    setOpen(true);
  };

  const startEdit = (r) => {
    setEditing(r);
    setForm({ name: r.name, condition: r.condition, points: r.points, description: r.description || "", enabled: r.enabled });
    setValid(null);
    setOpen(true);
  };

  const validate = async () => {
    setValidating(true);
    try {
      const res = await api.validateRule(form.condition);
      setValid(res);
      if (res.valid) toast.success("Condition compiles ✓");
      else toast.error(res.error || "Invalid condition");
    } catch { toast.error("Validation request failed"); }
    finally { setValidating(false); }
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error("Name is required");
    try {
      if (editing) {
        await api.updateRule(editing.id, form);
        toast.success("Rule updated");
      } else {
        await api.createRule(form);
        toast.success("Rule created");
      }
      setOpen(false);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Save failed");
    }
  };

  const remove = async (r) => {
    if (!window.confirm(`Delete rule "${r.name}"?`)) return;
    try { await api.deleteRule(r.id); toast.success("Deleted"); load(); }
    catch { toast.error("Delete failed"); }
  };

  return (
    <div className="page-shell" data-testid="rules-page">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
        <div>
          <h1 className="page-title">Rule Library</h1>
          <p className="page-sub">Edit, validate and ship fraud rules in real time — no redeploy required.</p>
        </div>
        <button className="btn" onClick={startCreate} data-testid="rule-create-btn"><Plus size={16} /> New Rule</button>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th><th>Condition</th><th>Points</th><th>Status</th><th></th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id} data-testid={`rule-row-${r.name}`}>
                <td><strong>{r.name}</strong><div style={{ color: "#94a3b8", fontSize: ".8rem" }}>{r.description}</div></td>
                <td><code style={{ background: "#f1f5f9", padding: "2px 6px", borderRadius: 6, fontSize: ".82rem" }}>{r.condition}</code></td>
                <td>{r.points}</td>
                <td>{r.enabled ? <span className="pill approve"><Check size={12} /> Enabled</span> : <span className="pill review">Disabled</span>}</td>
                <td style={{ textAlign: "right" }}>
                  <button className="btn ghost sm" onClick={() => startEdit(r)} data-testid={`rule-edit-${r.name}`}><Pencil size={12} /> Edit</button>{" "}
                  <button className="btn ghost sm" style={{ color: "#b91c1c", borderColor: "#fecaca" }} onClick={() => remove(r)} data-testid={`rule-delete-${r.name}`}><Trash2 size={12} /></button>
                </td>
              </tr>
            ))}
            {!rules.length && <tr><td colSpan={5} style={{ textAlign: "center", color: "#94a3b8", padding: "2rem" }}>No rules yet</td></tr>}
          </tbody>
        </table>
      </div>

      {open && (
        <div style={overlay} onClick={() => setOpen(false)}>
          <div className="card" style={modal} onClick={(e) => e.stopPropagation()} data-testid="rule-modal">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 800 }}>{editing ? "Edit Rule" : "Create Rule"}</h3>
              <button className="btn ghost sm" onClick={() => setOpen(false)}><X size={14} /></button>
            </div>

            <div style={{ display: "grid", gap: "1rem" }}>
              <div>
                <label className="label">Name</label>
                <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="high_value_first_time" data-testid="rule-name-input" />
              </div>
              <div>
                <label className="label">Condition (rule_engine grammar)</label>
                <textarea className="textarea" value={form.condition} onChange={(e) => { setForm({ ...form, condition: e.target.value }); setValid(null); }} data-testid="rule-condition-input" />
                <div style={{ display: "flex", gap: ".75rem", marginTop: ".5rem", alignItems: "center" }}>
                  <button className="btn ghost sm" onClick={validate} disabled={validating} data-testid="rule-validate-btn">{validating ? "Validating…" : "Validate"}</button>
                  {valid && (valid.valid ? <span className="pill approve">Compiles ✓</span> : <span className="pill block">{valid.error}</span>)}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label className="label">Points</label>
                  <input type="number" min={0} max={100} className="input" value={form.points} onChange={(e) => setForm({ ...form, points: Number(e.target.value) })} data-testid="rule-points-input" />
                </div>
                <div>
                  <label className="label">Enabled</label>
                  <select className="select" value={form.enabled ? "1" : "0"} onChange={(e) => setForm({ ...form, enabled: e.target.value === "1" })} data-testid="rule-enabled-select">
                    <option value="1">Enabled</option>
                    <option value="0">Disabled</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Description</label>
                <input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} data-testid="rule-desc-input" />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: ".75rem", marginTop: ".5rem" }}>
                <button className="btn ghost" onClick={() => setOpen(false)}>Cancel</button>
                <button className="btn" onClick={save} data-testid="rule-save-btn">{editing ? "Update Rule" : "Create Rule"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const overlay = {
  position: "fixed", inset: 0, background: "rgba(15,23,42,.55)",
  display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: "1rem",
};
const modal = { width: "100%", maxWidth: 640, maxHeight: "90vh", overflow: "auto" };
