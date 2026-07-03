# fraud_engine.py
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any
import math
import rule_engine


@dataclass
class SignalRule:
    name: str
    condition: str
    points: int
    description: str = ""
    enabled: bool = True
    compiled_rule: Any = field(default=None, repr=False)

    def __post_init__(self):
        try:
            ctx = rule_engine.Context(default_value=None)
            self.compiled_rule = rule_engine.Rule(self.condition, context=ctx)
        except Exception as e:
            self.compiled_rule = None
            self._compile_error = str(e)

    def matches(self, order: dict) -> bool:
        if not self.enabled or self.compiled_rule is None:
            return False
        try:
            return self.compiled_rule.matches(order)
        except Exception:
            return False


@dataclass
class TriggeredSignal:
    rule_name: str
    points: int
    description: str = ""


class ModuleRuleSet:
    def __init__(self, name: str, rules: list[SignalRule]):
        self.name = name
        self.rules = rules

    def evaluate(self, order: dict) -> list[TriggeredSignal]:
        triggered: list[TriggeredSignal] = []
        for rule in self.rules:
            if rule.matches(order):
                triggered.append(
                    TriggeredSignal(
                        rule_name=rule.name,
                        points=rule.points,
                        description=rule.description,
                    )
                )
        return triggered

def velocity_score(recent_count: int) -> int:
    """5+ tx within 60s → 30 pts; 3-4 → 15 pts."""
    if recent_count >= 5:
        return 30
    if recent_count >= 3:
        return 15
    return 0


def device_score(device_account_count: int) -> int:
    """One device → multiple accounts → suspicious."""
    if device_account_count >= 5:
        return 25
    if device_account_count >= 3:
        return 12
    return 0


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlmb / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def geo_score(prev: dict | None, curr: dict | None, minutes_since_prev: float | None) -> tuple[int, dict]:
    """Impossible-travel detection. >800 km/h implied speed → 35 pts."""
    info = {"impossible_travel": False, "implied_speed_kmh": 0.0, "distance_km": 0.0}
    if not prev or not curr or minutes_since_prev is None:
        return 0, info
    try:
        dist = haversine_km(prev["lat"], prev["lon"], curr["lat"], curr["lon"])
        info["distance_km"] = round(dist, 1)
        if minutes_since_prev <= 0:
            return 0, info
        speed = dist / (minutes_since_prev / 60.0)
        info["implied_speed_kmh"] = round(speed, 1)
        if speed > 800:
            info["impossible_travel"] = True
            return 35, info
        if speed > 400:
            return 18, info
    except Exception:
        pass
    return 0, info

class FraudEngine:
    def __init__(self, rules: list[SignalRule]):
        self.module = ModuleRuleSet("custom_rules", rules)

    def evaluate(
        self,
        order: dict,
        velocity_recent: int = 0,
        device_accounts: int = 0,
        geo_prev: dict | None = None,
        geo_curr: dict | None = None,
        geo_minutes: float | None = None,
        ml_probability: float | None = None,
    ) -> dict:
        triggered = self.module.evaluate(order)
        rule_score = sum(t.points for t in triggered)

        v_score = velocity_score(velocity_recent)
        d_score = device_score(device_accounts)
        g_score, g_info = geo_score(geo_prev, geo_curr, geo_minutes)

        level2_score = min(100, rule_score + v_score + d_score + g_score)

        if ml_probability is not None:
            final_score = round(0.6 * level2_score + 0.4 * (ml_probability * 100))
        else:
            final_score = level2_score
        final_score = max(0, min(100, int(final_score)))

        action = self.decide(final_score)

        return {
            "signals": [
                {"rule_name": t.rule_name, "points": t.points, "description": t.description}
                for t in triggered
            ],
            "rule_score": rule_score,
            "velocity_score": v_score,
            "device_score": d_score,
            "geo_score": g_score,
            "geo_info": g_info,
            "ml_probability": ml_probability,
            "level2_score": level2_score,
            "risk_score": final_score,
            "action": action,
        }

    @staticmethod
    def decide(score: int) -> str:
        if score < 31:
            return "APPROVE"
        if score < 61:
            return "REVIEW"
        return "BLOCK"
