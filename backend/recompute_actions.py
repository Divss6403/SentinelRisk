# recompute_actions.py
from pathlib import Path
import os
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv
from pymongo import MongoClient
from fraud_engine import SignalRule, FraudEngine

ROOT = Path(__file__).parent
load_dotenv(ROOT / '.env')

MONGO_URL = os.environ.get('MONGO_URL')
DB_NAME = os.environ.get('DB_NAME', 'fraud_db')

if not MONGO_URL:
    raise SystemExit('MONGO_URL not set in .env')

client = MongoClient(MONGO_URL, tls=True, tlsAllowInvalidCertificates=True)
db = client[DB_NAME]


def load_engine_from_db():
    docs = list(db.rules.find({}, {"_id": 0}))
    rules = []
    for d in docs:
        if not d.get('enabled', True):
            continue
        rules.append(SignalRule(name=d['name'], condition=d['condition'], points=int(d.get('points', 0)), description=d.get('description', ''), enabled=d.get('enabled', True)))
    return FraudEngine(rules)


def compute_context(order):
    customer_id = order.get('customer_id')
    device_id = order.get('device_id')
    geo_curr = order.get('geo') if isinstance(order.get('geo'), dict) else None

    velocity_recent = 0
    device_accounts = 0
    geo_prev = None
    geo_minutes = None

    if customer_id:
        since = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
        velocity_recent = db.transactions.count_documents({
            'customer_id': customer_id,
            'created_at_iso': {'$gte': since},
        })

        prev = db.transactions.find_one(
            {'customer_id': customer_id, 'geo': {'$exists': True}},
            sort=[('created_at_iso', -1)],
            projection={'_id': 0, 'geo': 1, 'created_at_iso': 1},
        )
        if prev and prev.get('geo') and geo_curr:
            geo_prev = prev['geo']
            try:
                prev_dt = datetime.fromisoformat(prev['created_at_iso'])
                delta = datetime.now(timezone.utc) - prev_dt
                geo_minutes = max(0.1, delta.total_seconds() / 60.0)
            except Exception:
                geo_minutes = None

    if device_id:
        agg = db.transactions.distinct('customer_id', {'device_id': device_id})
        device_accounts = len(agg)

    return {
        'velocity_recent': velocity_recent,
        'device_accounts': device_accounts,
        'geo_prev': geo_prev,
        'geo_curr': geo_curr,
        'geo_minutes': geo_minutes,
    }


def re_evaluate(limit=10000):
    eng = load_engine_from_db()
    updated = 0
    q = {'$or': [{'action': {'$exists': False}}, {'action': None}]}
    cursor = db.transactions.find(q, {'_id': 0}).limit(limit)
    for doc in cursor:
        order = dict(doc)
        ctx = compute_context(order)
        res = eng.evaluate(order, velocity_recent=ctx['velocity_recent'], device_accounts=ctx['device_accounts'], geo_prev=ctx['geo_prev'], geo_curr=ctx['geo_curr'], geo_minutes=ctx['geo_minutes'], ml_probability=None)
        tx_update = {
            'risk_score': res['risk_score'],
            'rule_score': res['rule_score'],
            'velocity_score': res['velocity_score'],
            'device_score': res['device_score'],
            'geo_score': res['geo_score'],
            'ml_probability': res.get('ml_probability'),
            'signals': res['signals'],
            'action': res['action'],
            'status': res['action'],
        }
        db.transactions.update_one({'id': doc.get('id')}, {'$set': tx_update})
        updated += 1
    return updated


if __name__ == '__main__':
    print('Re-evaluating transactions without actions...')
    n = re_evaluate(10000)
    print('Updated', n, 'transactions')
