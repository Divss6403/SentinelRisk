# ml_model.py
from __future__ import annotations

import numpy as np
from sklearn.ensemble import RandomForestClassifier

_RNG = np.random.default_rng(42)
_MODEL: RandomForestClassifier | None = None


def _generate_synthetic(n: int = 4000):
    X = []
    y = []
    for _ in range(n):
        is_fraud = _RNG.random() < 0.25
        if is_fraud:
            amount = _RNG.uniform(800, 8000)
            order_count = _RNG.choice([0, 0, 0, 1, 2])
            return_ratio = _RNG.uniform(0.4, 0.95)
            hour = _RNG.choice([1, 2, 3, 4, 23, 0])
            failed_payments = _RNG.integers(2, 7)
            cross_border = _RNG.choice([1, 1, 1, 0])
            vpn = _RNG.choice([1, 1, 0])
            device_age_days = _RNG.uniform(0, 30)
        else:
            amount = _RNG.uniform(10, 700)
            order_count = _RNG.integers(1, 80)
            return_ratio = _RNG.uniform(0.0, 0.3)
            hour = _RNG.integers(7, 22)
            failed_payments = _RNG.choice([0, 0, 0, 1])
            cross_border = _RNG.choice([0, 0, 0, 1])
            vpn = _RNG.choice([0, 0, 0, 1])
            device_age_days = _RNG.uniform(30, 1200)
        X.append([amount, order_count, return_ratio, hour, failed_payments,
                  cross_border, vpn, device_age_days])
        y.append(1 if is_fraud else 0)
    return np.array(X), np.array(y)


def _train():
    X, y = _generate_synthetic()
    clf = RandomForestClassifier(n_estimators=120, max_depth=10, random_state=42, n_jobs=1)
    clf.fit(X, y)
    return clf


def get_model() -> RandomForestClassifier:
    global _MODEL
    if _MODEL is None:
        _MODEL = _train()
    return _MODEL


def features_from_order(order: dict) -> list[float]:
    customer = order.get("customer") or {}
    return [
        float(order.get("order_value", order.get("amount", 0)) or 0),
        float(customer.get("order_count", 0) or 0),
        float(customer.get("return_ratio", 0) or 0),
        float(order.get("hour", 12) or 12),
        float(order.get("failed_payments", 0) or 0),
        1.0 if order.get("cross_border") else 0.0,
        1.0 if order.get("vpn") else 0.0,
        float(order.get("device_age_days", 365) or 365),
    ]


def predict_probability(order: dict) -> float:
    model = get_model()
    feats = np.array([features_from_order(order)])
    proba = model.predict_proba(feats)[0]
    
    classes = list(model.classes_)
    idx = classes.index(1) if 1 in classes else 0
    return float(proba[idx])
