# seed_data.py
from __future__ import annotations
import random
from datetime import datetime, timedelta, timezone

DEFAULT_RULES = [
    {
        "name": "high_value_order",
        "condition": "order_value > 1000",
        "points": 40,
        "description": "Order value exceeds 1000",
    },
    {
        "name": "very_high_value_order",
        "condition": "order_value > 5000",
        "points": 30,
        "description": "Order value exceeds 5000 (added on top of high_value_order)",
    },
    {
        "name": "new_customer",
        "condition": "customer.order_count == 0",
        "points": 20,
        "description": "First-time customer",
    },
    {
        "name": "high_value_first_time",
        "condition": "order_value > 500 and customer.order_count == 0",
        "points": 35,
        "description": "High value order from first-time customer",
    },
    {
        "name": "high_return_user",
        "condition": "customer.return_ratio > 0.5",
        "points": 30,
        "description": "Customer return ratio above 50%",
    },
    {
        "name": "multiple_failed_payments",
        "condition": "failed_payments >= 3",
        "points": 25,
        "description": "Three or more failed payment attempts",
    },
    {
        "name": "vpn_or_proxy",
        "condition": "vpn == true",
        "points": 25,
        "description": "Transaction originated from VPN/proxy",
    },
    {
        "name": "cross_border_transaction",
        "condition": "cross_border == true",
        "points": 15,
        "description": "Billing and shipping countries differ",
    },
    {
        "name": "odd_hour_transaction",
        "condition": "hour < 5 or hour >= 23",
        "points": 10,
        "description": "Transaction placed between 23:00 and 05:00",
    },
    {
        "name": "new_device",
        "condition": "device_age_days < 7",
        "points": 18,
        "description": "Transaction from a device less than 7 days old",
    },
]


COUNTRIES = ["India"]
DEVICES = ["android", "ios", "web-chrome", "web-firefox", "web-safari"]


def _rand_order(i: int) -> dict:
    rng = random.Random(i * 7 + 11)
    is_suspicious = rng.random() < 0.45
    if is_suspicious:
        order_value = rng.choice([rng.uniform(800, 6000), rng.uniform(1500, 8000)])
        order_count = rng.choice([0, 0, 1])
        return_ratio = rng.uniform(0.3, 0.9)
        hour = rng.choice([1, 2, 3, 4, 23, 0, 14, 16])
        failed_payments = rng.choice([0, 1, 3, 4])
        vpn = rng.random() < 0.55
        cross_border = False
        device_age_days = rng.uniform(0, 60)
    else:
        order_value = rng.uniform(10, 700)
        order_count = rng.randint(1, 80)
        return_ratio = rng.uniform(0.0, 0.3)
        hour = rng.randint(7, 22)
        failed_payments = rng.choice([0, 0, 0, 1])
        vpn = rng.random() < 0.08
        cross_border = False
        device_age_days = rng.uniform(30, 1200)

    minutes_ago = rng.randint(0, 60 * 24 * 14)  # last 14 days
    ts = datetime.now(timezone.utc) - timedelta(minutes=minutes_ago)

    return {
        "order_id": f"ORD-{10000 + i}",
        "customer_id": f"CUS-{rng.randint(1, 60)}",
        "amount": round(order_value, 2),
        "order_value": round(order_value, 2),
        "currency": "INR",
        "device": rng.choice(DEVICES),
        "device_id": f"DEV-{rng.randint(1, 90)}",
        "ip": f"{rng.randint(1,255)}.{rng.randint(0,255)}.{rng.randint(0,255)}.{rng.randint(0,255)}",
        "country": "India",
        "hour": hour,
        "failed_payments": failed_payments,
        "vpn": vpn,
        "cross_border": cross_border,
        "device_age_days": round(device_age_days, 1),
        "customer": {
            "order_count": order_count,
            "return_ratio": round(return_ratio, 2),
        },
        "geo": {
            "lat": round(rng.uniform(-60, 60), 4),
            "lon": round(rng.uniform(-180, 180), 4),
        },
        "created_at_iso": ts.isoformat(),
    }


def generate_seed_orders(n: int = 60) -> list[dict]:
    return [_rand_order(i) for i in range(n)]
