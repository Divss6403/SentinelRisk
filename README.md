# 🛡️ Enterprise Fraud Detection Platform

A production-grade, full-stack fraud detection system with a real-time rule engine, ML scoring, velocity tracking, and an operational risk dashboard — built for scale.

---


## 📸 Screenshots

| Dashboard | Rule Manager | Transactions |
|---|---|---|
| Risk KPIs, time-series, action distribution | Live rule CRUD with condition validation | Scored transactions with signal breakdown |

---

## 🧠 What It Does

Every incoming order is scored through a **three-tier decision pipeline**:

```
Order Input
    │
    ├─► Rule Engine        → condition-based signal points (hot-reload, no redeploy)
    ├─► Velocity Engine    → real-time transaction frequency per customer/device
    ├─► Geo Engine         → impossible travel detection across sessions
    ├─► Device Engine      → multi-account device fingerprinting
    └─► ML Model           → gradient-boosted fraud probability score
          │
          ▼
    Weighted Risk Score (0–100)
          │
    ┌─────┴─────┐──────────┐
  APPROVE     REVIEW     BLOCK
```

Final decision: **APPROVE / REVIEW / BLOCK** based on composite risk score thresholds.

---

## ⚙️ Tech Stack

### Backend
| Layer | Technology |
|---|---|
| API Framework | FastAPI (async) |
| Database | MongoDB Atlas (Motor async driver) |
| Rule Engine | `rule-engine` — expression-based DSL |
| ML Model | Scikit-learn (GradientBoostingClassifier) |
| File Ingestion | JSON + XML bulk upload (xmltodict) |
| Server | Uvicorn |

### Frontend
| Layer | Technology |
|---|---|
| Framework | React (CRA) |
| Styling | Tailwind CSS |
| Charts | Recharts (AreaChart, PieChart, BarChart) |
| Notifications | Sonner |
| Icons | Lucide React |
| Config | CRACO |

---

## 🏗️ Project Structure

```
RULE_ENGINE/
├── backend/
│   ├── server.py              # FastAPI app, all API routes, lifespan
│   ├── fraud_engine.py        # Three-tier scoring engine
│   ├── ml_model.py            # ML model training + inference
│   ├── seed_data.py           # Default rules + synthetic order generator
│   ├── seed_db.py             # One-time DB seeding script
│   ├── recompute_actions.py   # Backfill utility for re-scoring transactions
│   ├── requirements.txt
│   └── tests/
│       └── test_fraud_platform.py
│
└── frontend/
    ├── src/
    │   ├── pages/
    │   │   ├── Dashboard.jsx      # KPIs, time-series, rule effectiveness
    │   │   ├── RuleManager.jsx    # Live rule CRUD with condition validator
    │   │   └── Transactions.jsx   # Scored transaction explorer
    │   ├── lib/
    │   │   └── api.js             # Axios API client
    │   ├── components/
    │   ├── hooks/
    │   └── constants/
    ├── plugins/health-check/      # Custom webpack health endpoint plugin
    ├── craco.config.js
    └── tailwind.config.js
```

---

## 🔌 API Reference

### Fraud Evaluation
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/check_fraud` | Score a single order |
| `POST` | `/api/check_fraud/upload` | Bulk score via JSON or XML file |

### Rules
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/rules` | List all rules |
| `POST` | `/api/rules` | Create a new rule |
| `PUT` | `/api/rules/{id}` | Update a rule (hot-reload) |
| `DELETE` | `/api/rules/{id}` | Delete a rule |
| `POST` | `/api/rules/validate` | Validate rule condition syntax |

### Transactions
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/transactions` | List recent transactions (filter by action) |
| `GET` | `/api/transactions/{id}` | Get single transaction detail |

### Dashboard
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/dashboard/stats` | KPI summary |
| `GET` | `/api/dashboard/timeseries` | Daily transaction breakdown |
| `GET` | `/api/dashboard/action-distribution` | APPROVE/REVIEW/BLOCK counts |
| `GET` | `/api/dashboard/top-rules` | Most-triggered rules |
| `GET` | `/api/dashboard/country-stats` | Fraud by country |

---

## 🧩 Rule Engine DSL

Rules are written in plain boolean expressions evaluated against the order context:

```python
# High-value first-time buyer
order_value > 10000 and customer.order_count == 0

# Suspicious late-night order
hour >= 1 and hour <= 4 and order_value > 5000

# High return ratio customer
customer.return_ratio > 0.6 and order_value > 2000

# New device on large order
device_age_days < 7 and order_value > 8000
```

Rules are stored in MongoDB and reloaded into the engine **without a server restart** on every create/update/delete.

---

## 🤖 ML Scoring

- Model: `GradientBoostingClassifier` trained on synthetic fraud patterns
- Features: `order_value`, `hour`, `failed_payments`, `device_age_days`, `customer.order_count`, `customer.return_ratio`
- Output: fraud probability (0.0 – 1.0), converted to a weighted score component
- Falls back gracefully if model is unavailable

---

## 🔒 Risk Score Breakdown

| Component | Weight | Source |
|---|---|---|
| Rule Score | 40% | Matched signal rules |
| ML Score | 30% | GradientBoosting probability |
| Velocity Score | 15% | Txn frequency in last 60s |
| Device Score | 10% | Multi-account device usage |
| Geo Score | 5% | Impossible travel detection |

| Risk Score | Decision |
|---|---|
| 0 – 39 | ✅ APPROVE |
| 40 – 69 | ⚠️ REVIEW |
| 70 – 100 | 🚫 BLOCK |

---

## 🛠️ Local Setup

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Create .env
echo "MONGO_URL=mongodb+srv://..." > .env
echo "DB_NAME=fraud_db" >> .env
echo "PORT=8000" >> .env

uvicorn server:app --host 127.0.0.1 --port 8000 --reload
```

### Frontend

```bash
cd frontend
npm install

# Create .env
echo "REACT_APP_BACKEND_URL=http://127.0.0.1:8000" > .env

npm start
```

---

## ☁️ Deployment

### Backend → Render
- **Build Command:** `pip install -r requirements.txt`
- **Start Command:** `uvicorn server:app --host 0.0.0.0 --port $PORT`
- **Env Vars:** `MONGO_URL`, `DB_NAME`, `PORT`

### Frontend → Vercel
- **Framework:** Create React App
- **Build Command:** `npm run build`
- **Env Vars:** `REACT_APP_BACKEND_URL=https://your-render-app.onrender.com`

---

## 🧪 Tests

```bash
cd backend
pytest tests/test_fraud_platform.py -v
```

---

## 📊 Key Design Decisions

- **Hot-reload rules** — no redeploy needed; rule changes reflect instantly via engine cache invalidation
- **Async throughout** — Motor + FastAPI async routes handle concurrent evaluations without blocking
- **Sentinel-based seeding** — a `meta` collection prevents duplicate seed data across restarts
- **Graceful ML fallback** — if the ML model fails to load, the rule + velocity engines still score correctly
- **Bulk ingestion** — supports both JSON arrays and XML order files via a single upload endpoint

---

## 👤 Author

**Divyanshi Singh** — Backend & Systems Engineer  
Built as a production-grade portfolio project demonstrating fraud detection architecture, real-time rule engines, and ML integration at scale.

