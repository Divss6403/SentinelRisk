# test_fraud_platform.py
import os
import io
import json
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8000").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="session")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


class TestDashboard:
    def test_stats_shape_and_types(self, api_client):
        r = api_client.get(f"{API}/dashboard/stats")
        assert r.status_code == 200
        d = r.json()
        for k in ["total_transactions", "approved", "review", "blocked",
                  "rules_count", "avg_risk_score", "blocked_amount", "fraud_rate_pct"]:
            assert k in d, f"missing key {k}"
            assert isinstance(d[k], (int, float)), f"{k} not numeric: {d[k]!r}"
        assert d["total_transactions"] >= 1
        assert d["rules_count"] >= 10

    def test_timeseries_non_empty(self, api_client):
        r = api_client.get(f"{API}/dashboard/timeseries")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        first = data[0]
        for k in ["date", "APPROVE", "REVIEW", "BLOCK", "total"]:
            assert k in first

    def test_action_distribution(self, api_client):
        r = api_client.get(f"{API}/dashboard/action-distribution")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) == 3
        names = {item["name"] for item in data}
        assert names == {"Approve", "Review", "Block"}

    def test_top_rules_non_empty(self, api_client):
        r = api_client.get(f"{API}/dashboard/top-rules")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        assert "rule_name" in data[0] and "count" in data[0]

    def test_country_stats(self, api_client):
        r = api_client.get(f"{API}/dashboard/country-stats")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        assert "country" in data[0] and "total" in data[0]


class TestRules:
    def test_list_default_rules(self, api_client):
        r = api_client.get(f"{API}/rules")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 10
        for k in ["name", "condition", "points", "enabled"]:
            assert k in data[0]

    def test_validate_valid(self, api_client):
        r = api_client.post(f"{API}/rules/validate", json={"condition": "order_value > 2500"})
        assert r.status_code == 200
        assert r.json().get("valid") is True

    def test_validate_invalid(self, api_client):
        r = api_client.post(f"{API}/rules/validate", json={"condition": "order_value @@ bad"})
        assert r.status_code == 200
        assert r.json().get("valid") is False

    def test_create_invalid_condition_returns_400(self, api_client):
        payload = {"name": "TEST_bad_rule", "condition": "order_value @@ bad",
                   "points": 10, "description": "bad", "enabled": True}
        r = api_client.post(f"{API}/rules", json=payload)
        assert r.status_code == 400
        assert "detail" in r.json()

    def test_create_update_delete_rule_flow(self, api_client):
        name = f"TEST_high_value_{int(time.time())}"
        payload = {"name": name, "condition": "order_value > 2500", "points": 25,
                   "description": "test rule", "enabled": True}
        # CREATE
        r = api_client.post(f"{API}/rules", json=payload)
        assert r.status_code == 200, r.text
        created = r.json()
        assert created["name"] == name
        assert created["points"] == 25
        rule_id = created["id"]
        assert isinstance(rule_id, str) and len(rule_id) > 0

        # GET - confirm present
        r2 = api_client.get(f"{API}/rules")
        assert r2.status_code == 200
        assert any(x["name"] == name for x in r2.json())

        # UPDATE
        upd = {**payload, "points": 40, "description": "updated"}
        r3 = api_client.put(f"{API}/rules/{rule_id}", json=upd)
        assert r3.status_code == 200, r3.text
        assert r3.json()["points"] == 40
        assert r3.json()["description"] == "updated"

        # GET - confirm updated points
        r4 = api_client.get(f"{API}/rules")
        rec = next((x for x in r4.json() if x["id"] == rule_id), None)
        assert rec is not None and rec["points"] == 40

        # DELETE
        r5 = api_client.delete(f"{API}/rules/{rule_id}")
        assert r5.status_code == 200
        assert r5.json().get("deleted") is True

        # GET - confirm removed
        r6 = api_client.get(f"{API}/rules")
        assert not any(x["id"] == rule_id for x in r6.json())


FRAUD_TX = {
    "order_id": "TEST_FRAUD_001",
    "customer_id": "TEST_CUST_F1",
    "order_value": 1500,
    "amount": 1500,
    "currency": "INR",
    "device_id": "dev-x",
    "country": "India",
    "hour": 2,
    "failed_payments": 3,
    "vpn": True,
    "cross_border": False,
    "device_age_days": 3,
    "customer": {"order_count": 0, "return_ratio": 0.7},
}

CLEAN_TX = {
    "order_id": "TEST_CLEAN_001",
    "customer_id": "TEST_CUST_C1",
    "order_value": 50,
    "amount": 50,
    "currency": "INR",
    "device_id": "dev-good",
    "country": "India",
    "hour": 14,
    "failed_payments": 0,
    "vpn": False,
    "cross_border": False,
    "device_age_days": 800,
    "customer": {"order_count": 30, "return_ratio": 0.02},
}


class TestCheckFraud:
    def test_check_fraud_high_risk_blocks(self, api_client):
        r = api_client.post(f"{API}/check_fraud", json=FRAUD_TX)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "transaction" in data and "result" in data
        result = data["result"]
        assert result["action"] == "BLOCK", f"expected BLOCK got {result['action']} score={result.get('risk_score')}"
        assert result["risk_score"] >= 60
        names = {s.get("rule_name") for s in result.get("signals", [])}
        assert "high_value_order" in names or any("high_value" in n.lower() for n in names if n)
        assert "new_customer" in names or any("new_customer" in n.lower() for n in names if n)
        assert len(result["signals"]) >= 2

    def test_check_fraud_clean_approves(self, api_client):
        r = api_client.post(f"{API}/check_fraud", json=CLEAN_TX)
        assert r.status_code == 200, r.text
        data = r.json()
        result = data["result"]
        assert result["action"] == "APPROVE", f"expected APPROVE got {result['action']} score={result.get('risk_score')}"
        assert result["risk_score"] < 31

    def test_upload_json_batch(self, api_client):
        orders = [
            {"order_id": "TEST_J1", "order_value": 200, "hour": 13, "customer": {"order_count": 5}},
            {"order_id": "TEST_J2", "order_value": 3000, "hour": 3, "vpn": True, "customer": {"order_count": 0}},
            {"order_id": "TEST_J3", "order_value": 80, "hour": 12, "customer": {"order_count": 25}},
        ]
        files = {"file": ("orders.json", json.dumps(orders).encode(), "application/json")}
        r = requests.post(f"{API}/check_fraud/upload", files=files)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["summary"]["total"] == 3
        assert len(d["items"]) == 3

    def test_upload_xml_batch(self, api_client):
        xml_body = (
            b"<orders>"
            b"<order><order_id>TEST_XML_1</order_id><order_value>2000</order_value>"
            b"<hour>3</hour><vpn>true</vpn>"
            b"<customer><order_count>0</order_count></customer></order>"
            b"<order><order_id>TEST_XML_2</order_id><order_value>40</order_value>"
            b"<hour>11</hour><customer><order_count>10</order_count></customer></order>"
            b"</orders>"
        )
        files = {"file": ("orders.xml", xml_body, "application/xml")}
        r = requests.post(f"{API}/check_fraud/upload", files=files)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["summary"]["total"] == 2
        assert len(d["items"]) == 2

#transactions #
class TestTransactions:
    def test_list_recent(self, api_client):
        r = api_client.get(f"{API}/transactions?limit=20")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        assert "action" in data[0] and "risk_score" in data[0]

    def test_filter_by_block(self, api_client):
        r = api_client.get(f"{API}/transactions?action=BLOCK&limit=20")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        if len(data) > 0:
            assert all(d.get("action") == "BLOCK" for d in data)

    def test_get_transaction_by_order_id(self, api_client):
        # use the TEST_FRAUD_001 inserted earlier
        r = api_client.get(f"{API}/transactions/TEST_FRAUD_001")
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("order_id") == "TEST_FRAUD_001"
        assert "signals" in d
