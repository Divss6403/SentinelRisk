# seed_db.py
from pathlib import Path
import os
import uuid
from dotenv import load_dotenv
from pymongo import MongoClient

ROOT = Path(__file__).parent
load_dotenv(ROOT / '.env')

MONGO_URL = os.environ.get('MONGO_URL')
DB_NAME = os.environ.get('DB_NAME', 'fraud_db')

if not MONGO_URL:
    raise SystemExit('MONGO_URL not set in .env')

client = MongoClient(MONGO_URL, tls=True, tlsAllowInvalidCertificates=True)
db = client[DB_NAME]

from seed_data import DEFAULT_RULES, generate_seed_orders

def seed_rules():
    docs = []
    for r in DEFAULT_RULES:
        docs.append({"id": str(uuid.uuid4()), **r, "enabled": True})
    if docs:
        db.rules.delete_many({})
        db.rules.insert_many(docs)
    return len(docs)

def seed_transactions(n=60):
    orders = generate_seed_orders(n)
    for o in orders:
        o.setdefault('id', str(uuid.uuid4()))
    if orders:
        db.transactions.delete_many({})
        db.transactions.insert_many(orders)
    return len(orders)

if __name__ == '__main__':
    print('Seeding rules...')
    r = seed_rules()
    print(f'Inserted {r} rules')
    print('Seeding transactions...')
    t = seed_transactions(120)
    print(f'Inserted {t} transactions')
    print('Done.')
