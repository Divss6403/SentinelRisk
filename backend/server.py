# server.py
from __future__ import annotations

import os
import uuid
import logging
import json
import xmltodict
from contextlib import asynccontextmanager
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any

from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, ConfigDict
from dotenv import load_dotenv

from fraud_engine import SignalRule, FraudEngine
from ml_model import predict_probability, get_model
from seed_data import DEFAULT_RULES, generate_seed_orders

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

try:
    import uvicorn.config as uvicorn_config
    _uvicorn_config_init = uvicorn_config.Config.__init__

    def _patched_uvicorn_config_init(self, *args, **kwargs):
        if "port" not in kwargs:
            if len(args) < 3:
                kwargs["port"] = int(os.environ.get("PORT", "8000"))
            elif args[2] == 8000:
                args = list(args)
                args[2] = int(os.environ.get("PORT", "8000"))
                args = tuple(args)
        return _uvicorn_config_init(self, *args, **kwargs)

    uvicorn_config.Config.__init__ = _patched_uvicorn_config_init
except Exception:
    pass

mongo_url = os.environ["MONGO_URL"]
db_name = os.environ["DB_NAME"]
client = AsyncIOMotorClient(mongo_url, tls=True, tlsAllowInvalidCertificates=True)
db = client[db_name]

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
log = logging.getLogger("fraud-api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """FastAPI lifespan event handler for startup and shutdown."""
    # Startup
    try:
        get_model()
    except Exception as e:
        log.warning("ML model warmup failed: %s", e)

    try:
        if await db.rules.count_documents({}) == 0:
            log.info("Seeding default rules + demo transactions ...")
            for r in DEFAULT_RULES:
                await db.rules.insert_one({"id": str(uuid.uuid4()), **r, "enabled": True})
            await _load_engine()
        if await db.transactions.count_documents({}) == 0:
            for o in generate_seed_orders(60):
                await _evaluate_order(o, store=True)
        await _load_engine()
        log.info("Startup ready. Rules=%d Tx=%d",
                 await db.rules.count_documents({}),
                 await db.transactions.count_documents({}))
    except Exception as e:
        log.warning("startup seed skipped: %s", e)
    
    yield
    
    # Shutdown
    client.close()


app = FastAPI(title="Enterprise Fraud Detection Platform", lifespan=lifespan)
api = APIRouter(prefix="/api")


class RuleIn(BaseModel):
    name: str
    condition: str
    points: int = Field(ge=0, le=100)
    description: str = ""
    enabled: bool = True


class RuleOut(RuleIn):
    model_config = ConfigDict(extra="ignore")
    id: str


class TransactionIn(BaseModel):
    model_config = ConfigDict(extra="allow")
    order_id: str | None = None
    customer_id: str | None = None
    amount: float | None = None
    order_value: float | None = None
    currency: str | None = "INR"
    device: str | None = None
    device_id: str | None = None
    country: str | None = "India"
    ip: str | None = None
    hour: int | None = None
    failed_payments: int | None = 0
    vpn: bool | None = False
    cross_border: bool | None = False
    device_age_days: float | None = 365
    customer: dict | None = None
    geo: dict | None = None



_engine_cache: dict[str, Any] = {"engine": None, "loaded_at": None}


async def _load_engine() -> FraudEngine:
    docs = await db.rules.find({}, {"_id": 0}).to_list(1000)
    rules: list[SignalRule] = []
    for d in docs:
        if not d.get("enabled", True):
            continue
        rules.append(SignalRule(
            name=d["name"],
            condition=d["condition"],
            points=int(d.get("points", 0)),
            description=d.get("description", ""),
            enabled=d.get("enabled", True),
        ))
    eng = FraudEngine(rules)
    _engine_cache["engine"] = eng
    _engine_cache["loaded_at"] = datetime.now(timezone.utc)
    return eng


async def get_engine() -> FraudEngine:
    if _engine_cache["engine"] is None:
        return await _load_engine()
    return _engine_cache["engine"]


def _normalise_order(order: dict) -> dict:
    """Ensure rule_engine context has the keys it needs with sane defaults."""
    o = dict(order)
    if o.get("order_value") is None and o.get("amount") is not None:
        o["order_value"] = o["amount"]
    if o.get("amount") is None and o.get("order_value") is not None:
        o["amount"] = o["order_value"]
    o.setdefault("order_value", 0)
    o.setdefault("amount", 0)
    o.setdefault("hour", datetime.now(timezone.utc).hour)
    o.setdefault("failed_payments", 0)
    o.setdefault("vpn", False)
    o["cross_border"] = False
    o.setdefault("device_age_days", 365)
    o["currency"] = "INR"
    o["country"] = "India"
    customer = o.get("customer") or {}
    customer.setdefault("order_count", 0)
    customer.setdefault("return_ratio", 0)
    o["customer"] = customer
    return o


async def _compute_context(order: dict) -> dict:
    customer_id = order.get("customer_id")
    device_id = order.get("device_id")
    geo_curr = order.get("geo") if isinstance(order.get("geo"), dict) else None

    velocity_recent = 0
    device_accounts = 0
    geo_prev = None
    geo_minutes = None

    if customer_id:
        since = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
        velocity_recent = await db.transactions.count_documents({
            "customer_id": customer_id,
            "created_at_iso": {"$gte": since},
        })

        prev = await db.transactions.find_one(
            {"customer_id": customer_id, "geo": {"$exists": True}},
            sort=[("created_at_iso", -1)],
            projection={"_id": 0, "geo": 1, "created_at_iso": 1},
        )
        if prev and prev.get("geo") and geo_curr:
            geo_prev = prev["geo"]
            try:
                prev_dt = datetime.fromisoformat(prev["created_at_iso"])
                delta = datetime.now(timezone.utc) - prev_dt
                geo_minutes = max(0.1, delta.total_seconds() / 60.0)
            except Exception:
                geo_minutes = None

    if device_id:
        agg = await db.transactions.distinct("customer_id", {"device_id": device_id})
        device_accounts = len(agg)

    return {
        "velocity_recent": velocity_recent,
        "device_accounts": device_accounts,
        "geo_prev": geo_prev,
        "geo_curr": geo_curr,
        "geo_minutes": geo_minutes,
    }


async def _evaluate_order(order: dict, store: bool = True) -> dict:
    engine = await get_engine()
    order = _normalise_order(order)
    ctx = await _compute_context(order)

    try:
        ml_prob = predict_probability(order)
    except Exception as e:
        log.warning("ml predict failed: %s", e)
        ml_prob = None

    result = engine.evaluate(
        order,
        velocity_recent=ctx["velocity_recent"],
        device_accounts=ctx["device_accounts"],
        geo_prev=ctx["geo_prev"],
        geo_curr=ctx["geo_curr"],
        geo_minutes=ctx["geo_minutes"],
        ml_probability=ml_prob,
    )

    tx_doc = {
        **order,
        "order_id": order.get("order_id") or f"ORD-{uuid.uuid4().hex[:10].upper()}",
        "id": str(uuid.uuid4()),
        "risk_score": result["risk_score"],
        "rule_score": result["rule_score"],
        "velocity_score": result["velocity_score"],
        "device_score": result["device_score"],
        "geo_score": result["geo_score"],
        "ml_probability": result["ml_probability"],
        "signals": result["signals"],
        "action": result["action"],
        "status": result["action"],
        "created_at_iso": order.get("created_at_iso") or datetime.now(timezone.utc).isoformat(),
    }

    if store:
        await db.transactions.insert_one(dict(tx_doc))

    tx_doc.pop("_id", None)
    return {"transaction": tx_doc, "result": result}


@api.get("/")
async def root():
    return {"service": "Fraud Detection Platform", "status": "ok"}


@api.get("/rules", response_model=list[RuleOut])
async def list_rules():
    out: list[RuleOut] = []
    async for d in db.rules.find({}, {"_id": 0}):
        out.append(RuleOut(
            id=d.get("id", d.get("name")),
            name=d["name"],
            condition=d["condition"],
            points=int(d.get("points", 0)),
            description=d.get("description", ""),
            enabled=d.get("enabled", True),
        ))
    return out


@api.post("/rules", response_model=RuleOut)
async def create_rule(rule: RuleIn):
    # Validate condition 
    test = SignalRule(name=rule.name, condition=rule.condition, points=rule.points)
    if test.compiled_rule is None:
        raise HTTPException(status_code=400, detail=f"Invalid condition: {getattr(test, '_compile_error', 'parse error')}")

    if await db.rules.find_one({"name": rule.name}):
        raise HTTPException(status_code=409, detail=f"Rule '{rule.name}' already exists")

    doc = {"id": str(uuid.uuid4()), **rule.model_dump()}
    await db.rules.insert_one(dict(doc))
    await _load_engine()
    doc.pop("_id", None)
    return RuleOut(**doc)


@api.put("/rules/{rule_id}", response_model=RuleOut)
async def update_rule(rule_id: str, rule: RuleIn):
    test = SignalRule(name=rule.name, condition=rule.condition, points=rule.points)
    if test.compiled_rule is None:
        raise HTTPException(status_code=400, detail=f"Invalid condition: {getattr(test, '_compile_error', 'parse error')}")

    existing = await db.rules.find_one({"id": rule_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Rule not found")

    await db.rules.update_one({"id": rule_id}, {"$set": rule.model_dump()})
    await _load_engine()
    return RuleOut(id=rule_id, **rule.model_dump())


@api.delete("/rules/{rule_id}")
async def delete_rule(rule_id: str):
    res = await db.rules.delete_one({"id": rule_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Rule not found")
    await _load_engine()
    return {"deleted": True, "id": rule_id}


@api.post("/rules/validate")
async def validate_rule(payload: dict):
    test = SignalRule(name="test", condition=payload.get("condition", ""), points=0)
    if test.compiled_rule is None:
        return {"valid": False, "error": getattr(test, "_compile_error", "parse error")}
    return {"valid": True}


@api.post("/check_fraud")
async def check_fraud(order: dict):
    res = await _evaluate_order(order, store=True)
    return res


@api.post("/check_fraud/upload")
async def check_fraud_upload(file: UploadFile = File(...)):
    """Accepts a JSON file or XML file containing one or many orders."""
    raw = await file.read()
    name = (file.filename or "").lower()

    orders: list[dict] = []
    try:
        if name.endswith(".xml") or raw.lstrip().startswith(b"<"):
            parsed = xmltodict.parse(raw)
            
            if "orders" in parsed and isinstance(parsed["orders"], dict):
                inner = parsed["orders"].get("order") or parsed["orders"].get("transaction")
                if isinstance(inner, list):
                    orders = inner
                elif isinstance(inner, dict):
                    orders = [inner]
                else:
                    orders = [parsed["orders"]]
            else:
              
                root_key = next(iter(parsed))
                inner = parsed[root_key]
                if isinstance(inner, list):
                    orders = inner
                else:
                    orders = [inner]
        else:
            data = json.loads(raw.decode("utf-8"))
            if isinstance(data, list):
                orders = data
            elif isinstance(data, dict) and "orders" in data:
                orders = data["orders"]
            else:
                orders = [data]
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse file: {e}")

    results = []
    for o in orders:
        if not isinstance(o, dict):
            continue
        for k in ("order_value", "amount", "hour", "failed_payments", "device_age_days"):
            if k in o and isinstance(o[k], str):
                try:
                    o[k] = float(o[k]) if "." in o[k] else int(o[k])
                except ValueError:
                    pass
        for k in ("vpn", "cross_border"):
            if k in o and isinstance(o[k], str):
                o[k] = o[k].lower() in ("true", "1", "yes")
        if "customer" in o and isinstance(o["customer"], dict):
            for k in ("order_count", "return_ratio"):
                if k in o["customer"] and isinstance(o["customer"][k], str):
                    try:
                        o["customer"][k] = float(o["customer"][k]) if "." in o["customer"][k] else int(o["customer"][k])
                    except ValueError:
                        pass
        res = await _evaluate_order(o, store=True)
        results.append(res)

    summary = {
        "total": len(results),
        "approved": sum(1 for r in results if r["result"]["action"] == "APPROVE"),
        "review": sum(1 for r in results if r["result"]["action"] == "REVIEW"),
        "blocked": sum(1 for r in results if r["result"]["action"] == "BLOCK"),
    }
    return {"summary": summary, "items": results}


@api.get("/transactions")
async def list_transactions(limit: int = 100, action: str | None = None):
    q: dict = {}
    if action:
        q["action"] = action.upper()
    cursor = db.transactions.find(q, {"_id": 0}).sort("created_at_iso", -1).limit(limit)
    return await cursor.to_list(limit)


@api.get("/transactions/{tx_id}")
async def get_transaction(tx_id: str):
    doc = await db.transactions.find_one({"$or": [{"id": tx_id}, {"order_id": tx_id}]}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return doc


@api.get("/dashboard/stats")
async def dashboard_stats():
    total = await db.transactions.count_documents({})
    approved = await db.transactions.count_documents({"action": "APPROVE"})
    review = await db.transactions.count_documents({"action": "REVIEW"})
    blocked = await db.transactions.count_documents({"action": "BLOCK"})
    rules_count = await db.rules.count_documents({})

    cursor = db.transactions.find({}, {"_id": 0, "risk_score": 1, "amount": 1}).sort("created_at_iso", -1).limit(500)
    docs = await cursor.to_list(500)
    avg_risk = round(sum(d.get("risk_score", 0) for d in docs) / max(1, len(docs)), 1)
    blocked_amount = sum(
        (d.get("amount") or 0)
        for d in (await db.transactions.find({"action": "BLOCK"}, {"_id": 0, "amount": 1}).to_list(5000))
    )
    fraud_rate = round(100 * (blocked + review) / max(1, total), 1)
    return {
        "total_transactions": total,
        "approved": approved,
        "review": review,
        "blocked": blocked,
        "rules_count": rules_count,
        "avg_risk_score": avg_risk,
        "blocked_amount": round(blocked_amount, 2),
        "fraud_rate_pct": fraud_rate,
    }


@api.get("/dashboard/timeseries")
async def dashboard_timeseries(days: int = 14):
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    docs = await db.transactions.find(
        {"created_at_iso": {"$gte": since}},
        {"_id": 0, "created_at_iso": 1, "action": 1},
    ).to_list(20000)
    buckets: dict[str, dict] = {}
    for d in docs:
        try:
            day = d["created_at_iso"][:10]
        except Exception:
            continue
        b = buckets.setdefault(day, {"date": day, "APPROVE": 0, "REVIEW": 0, "BLOCK": 0, "total": 0})
        a = d.get("action", "APPROVE")
        if a in b:
            b[a] += 1
        b["total"] += 1
    series = sorted(buckets.values(), key=lambda x: x["date"])
    return series


@api.get("/dashboard/action-distribution")
async def dashboard_action_distribution():
    approved = await db.transactions.count_documents({"action": "APPROVE"})
    review = await db.transactions.count_documents({"action": "REVIEW"})
    blocked = await db.transactions.count_documents({"action": "BLOCK"})
    return [
        {"name": "Approve", "value": approved, "color": "#475569"},
        {"name": "Review", "value": review, "color": "#94a3b8"},
        {"name": "Block", "value": blocked, "color": "#1e293b"},
    ]


@api.get("/dashboard/top-rules")
async def dashboard_top_rules(limit: int = 8):
    pipeline = [
        {"$unwind": "$signals"},
        {"$group": {"_id": "$signals.rule_name", "count": {"$sum": 1}, "points": {"$sum": "$signals.points"}}},
        {"$sort": {"count": -1}},
        {"$limit": limit},
        {"$project": {"_id": 0, "rule_name": "$_id", "count": 1, "points": 1}},
    ]
    return await db.transactions.aggregate(pipeline).to_list(limit)


@api.get("/dashboard/country-stats")
async def dashboard_country_stats():
    pipeline = [
        {"$group": {
            "_id": "$country",
            "total": {"$sum": 1},
            "blocked": {"$sum": {"$cond": [{"$eq": ["$action", "BLOCK"]}, 1, 0]}},
        }},
        {"$sort": {"total": -1}},
        {"$limit": 10},
        {"$project": {"_id": 0, "country": "$_id", "total": 1, "blocked": 1}},
    ]
    return await db.transactions.aggregate(pipeline).to_list(10)


@api.post("/admin/seed")
async def admin_seed(force: bool = False):
    rules_exist = await db.rules.count_documents({})
    tx_exist = await db.transactions.count_documents({})

    inserted_rules = 0
    inserted_tx = 0

    if force:
        await db.rules.delete_many({})
        await db.transactions.delete_many({})
        rules_exist = 0
        tx_exist = 0

    if rules_exist == 0:
        for r in DEFAULT_RULES:
            await db.rules.insert_one({"id": str(uuid.uuid4()), **r, "enabled": True})
            inserted_rules += 1

    await _load_engine()

    if tx_exist == 0:
        seeds = generate_seed_orders(60)
        for o in seeds:
            await _evaluate_order(o, store=True)
            inserted_tx += 1

    return {"rules_inserted": inserted_rules, "transactions_inserted": inserted_tx}


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", "8001"))
    host = os.environ.get("HOST", "127.0.0.1")
    print(f"Starting backend on http://{host}:{port}")
    uvicorn.run(app, host=host, port=port, reload=False)
