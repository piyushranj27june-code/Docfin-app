"""Comprehensive backend API tests for Doctor Finance AI."""
import os
import time
import uuid
import pytest
import requests

BASE_URL = (os.environ.get("EXPO_PUBLIC_BACKEND_URL")
            or "https://medic-finance-ai.preview.emergentagent.com").rstrip("/")


# ---------- Health ----------
class TestHealth:
    def test_root(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data.get("status") == "ok"


# ---------- Auth ----------
class TestAuth:
    def test_register_new_user(self, api_client):
        email = f"test_user_{uuid.uuid4().hex[:8]}@example.com"
        r = api_client.post(f"{BASE_URL}/api/auth/register", json={
            "email": email, "password": "testpass123",
            "name": "Test Doc", "specialty": "Cardio", "hospital": "TestHosp",
        }, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "access_token" in data and data["token_type"] == "bearer"
        assert data["user"]["email"] == email
        assert data["user"]["name"] == "Test Doc"
        pytest.new_user_email = email
        pytest.new_user_token = data["access_token"]

    def test_register_duplicate_email_rejected(self, api_client):
        email = getattr(pytest, "new_user_email", None)
        if not email:
            pytest.skip("requires test_register_new_user")
        r = api_client.post(f"{BASE_URL}/api/auth/register", json={
            "email": email, "password": "x", "name": "x",
        }, timeout=15)
        assert r.status_code == 400

    def test_login_demo(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@doctor.com", "password": "demo1234",
        }, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["user"]["email"] == "demo@doctor.com"
        assert "access_token" in data

    def test_login_wrong_password(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@doctor.com", "password": "wrong",
        }, timeout=15)
        assert r.status_code == 401

    def test_me_with_token(self, api_client, auth_headers):
        r = api_client.get(f"{BASE_URL}/api/auth/me", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        assert r.json()["email"] == "demo@doctor.com"

    def test_protected_endpoint_without_token(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/auth/me", timeout=10)
        # HTTPBearer returns 403 by default when no auth provided
        assert r.status_code in (401, 403)

    def test_dashboard_without_token(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/dashboard", timeout=10)
        assert r.status_code in (401, 403)


# ---------- Loans ----------
class TestLoans:
    def test_emi_calc(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/loans/calculate", json={
            "principal": 1000000, "rate": 10, "tenure_months": 120,
        }, timeout=15)
        assert r.status_code == 200
        data = r.json()
        # Standard EMI for 10L @ 10% for 120 months is ~13,215
        assert 13000 <= data["emi"] <= 13500
        assert data["total_payable"] > 1000000
        assert data["total_interest"] > 0

    def test_emi_zero_principal(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/loans/calculate", json={
            "principal": 0, "rate": 10, "tenure_months": 12,
        }, timeout=10)
        assert r.status_code == 200
        assert r.json()["emi"] == 0

    def test_create_list_loan(self, api_client, auth_headers):
        r = api_client.post(f"{BASE_URL}/api/loans", headers=auth_headers, json={
            "name": "TEST_Car Loan", "principal": 500000, "rate": 9, "tenure_months": 60,
        }, timeout=15)
        assert r.status_code == 200
        loan = r.json()
        assert loan["emi"] > 0
        loan_id = loan["id"]
        # list and verify presence
        lr = api_client.get(f"{BASE_URL}/api/loans", headers=auth_headers, timeout=15)
        assert lr.status_code == 200
        assert any(l["id"] == loan_id for l in lr.json())
        # cleanup
        d = api_client.delete(f"{BASE_URL}/api/loans/{loan_id}", headers=auth_headers, timeout=15)
        assert d.status_code == 200


# ---------- Investments ----------
class TestInvestments:
    def test_sip_calc(self, api_client):
        r = api_client.post(
            f"{BASE_URL}/api/investments/sip-calc",
            params={"monthly": 10000, "years": 15, "rate": 12},
            timeout=15,
        )
        assert r.status_code == 200
        data = r.json()
        assert data["invested"] == 1800000  # 10k * 12 * 15
        # 15y SIP @ 12% ~ ~50L
        assert 4500000 < data["future_value"] < 5500000
        assert data["gain"] > 0

    def test_create_list_delete_investment(self, api_client, auth_headers):
        r = api_client.post(f"{BASE_URL}/api/investments", headers=auth_headers, json={
            "name": "TEST_SIP", "type": "SIP", "amount": 50000,
            "monthly_contribution": 5000, "expected_return": 12,
        }, timeout=15)
        assert r.status_code == 200
        inv = r.json()
        # current_value should default to amount
        assert inv["current_value"] == 50000
        iid = inv["id"]
        lr = api_client.get(f"{BASE_URL}/api/investments", headers=auth_headers, timeout=15)
        assert any(i["id"] == iid for i in lr.json())
        d = api_client.delete(f"{BASE_URL}/api/investments/{iid}", headers=auth_headers, timeout=15)
        assert d.status_code == 200


# ---------- Tax ----------
class TestTax:
    def test_tax_basic(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/tax/calculate", json={
            "gross_income": 1500000, "deduction_80c": 150000, "deduction_80d": 25000,
            "home_loan_interest": 200000, "nps_80ccd1b": 50000,
        }, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "old_regime_tax" in data
        assert "new_regime_tax" in data
        assert data["recommended"] in ("Old Regime", "New Regime")
        # Old has more deductions => taxable should be lower than gross
        assert data["old_regime_taxable"] < 1500000
        assert data["new_regime_taxable"] < 1500000

    def test_tax_87a_new_regime_below_12L(self, api_client):
        # Gross 12L, std-ded 75k => taxable ~11.25L => 87A => zero tax under new
        r = api_client.post(f"{BASE_URL}/api/tax/calculate", json={
            "gross_income": 1200000,
        }, timeout=15)
        assert r.status_code == 200
        assert r.json()["new_regime_tax"] == 0

    def test_tax_old_regime_cess(self, api_client):
        # Gross 20L, minimal deductions => non-trivial old tax with 4% cess applied
        r = api_client.post(f"{BASE_URL}/api/tax/calculate", json={
            "gross_income": 2000000, "deduction_80c": 0, "deduction_80d": 0,
            "home_loan_interest": 0, "nps_80ccd1b": 0, "hra_exempt": 0,
            "professional_tax": 0,
        }, timeout=15)
        assert r.status_code == 200
        data = r.json()
        # Old taxable = 2000000 - 50000 = 1950000
        # base tax = 12500 + 100000 + 285000 = 397500; *1.04 = 413400
        assert abs(data["old_regime_tax"] - 413400) < 1.0


# ---------- Expenses ----------
class TestExpenses:
    def test_expense_with_explicit_category(self, api_client, auth_headers):
        r = api_client.post(f"{BASE_URL}/api/expenses", headers=auth_headers, json={
            "description": "TEST_manual", "amount": 123.45, "category": "Food & Dining",
        }, timeout=20)
        assert r.status_code == 200
        e = r.json()
        assert e["category"] == "Food & Dining"
        assert e["ai_categorized"] is False
        api_client.delete(f"{BASE_URL}/api/expenses/{e['id']}", headers=auth_headers, timeout=10)

    def test_expense_ai_categorization(self, api_client, auth_headers):
        r = api_client.post(f"{BASE_URL}/api/expenses", headers=auth_headers, json={
            "description": "TEST_Uber ride to clinic", "amount": 350,
        }, timeout=45)  # LLM takes time
        assert r.status_code == 200
        e = r.json()
        valid = [
            "Food & Dining", "Transportation", "Housing & Rent", "Utilities",
            "Medical Equipment", "Continuing Education", "Insurance", "Investments",
            "Loan EMI", "Entertainment", "Shopping", "Travel", "Healthcare", "Other",
        ]
        assert e["category"] in valid, f"got {e['category']}"
        assert e["ai_categorized"] is True
        api_client.delete(f"{BASE_URL}/api/expenses/{e['id']}", headers=auth_headers, timeout=10)

    def test_list_and_summary(self, api_client, auth_headers):
        lr = api_client.get(f"{BASE_URL}/api/expenses", headers=auth_headers, timeout=15)
        assert lr.status_code == 200
        assert isinstance(lr.json(), list)
        sr = api_client.get(f"{BASE_URL}/api/expenses/summary", headers=auth_headers, timeout=15)
        assert sr.status_code == 200
        s = sr.json()
        assert "by_category" in s and "total" in s and "month_total" in s and "count" in s


# ---------- Hospital ----------
class TestHospital:
    def test_create_revenue_and_cashflow_math(self, api_client, auth_headers):
        r = api_client.post(f"{BASE_URL}/api/hospital/revenue", headers=auth_headers, json={
            "month": "2099-01",
            "opd_revenue": 100000, "ipd_revenue": 50000, "pharmacy_revenue": 20000,
            "lab_revenue": 10000, "other_revenue": 5000,
            "operating_costs": 40000, "staff_costs": 60000,
            "notes": "TEST",
        }, timeout=15)
        assert r.status_code == 200
        rev = r.json()
        assert rev["total_revenue"] == 185000.0
        assert rev["net_cashflow"] == 85000.0
        rid = rev["id"]
        d = api_client.delete(f"{BASE_URL}/api/hospital/revenue/{rid}", headers=auth_headers, timeout=10)
        assert d.status_code == 200

    def test_leakage_alerts(self, api_client, auth_headers):
        r = api_client.get(f"{BASE_URL}/api/hospital/leakage", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "alerts" in data and isinstance(data["alerts"], list)
        assert "months_analyzed" in data


# ---------- Productivity ----------
class TestProductivity:
    def test_create_productivity_auto_compute(self, api_client, auth_headers):
        r = api_client.post(f"{BASE_URL}/api/productivity", headers=auth_headers, json={
            "date": "2099-01-01", "patients_seen": 20, "hours_worked": 8,
            "revenue_generated": 24000, "procedures": 1, "notes": "TEST",
        }, timeout=15)
        assert r.status_code == 200
        p = r.json()
        assert p["patients_per_hour"] == 2.5
        assert p["revenue_per_patient"] == 1200.0
        api_client.delete(f"{BASE_URL}/api/productivity/{p['id']}", headers=auth_headers, timeout=10)

    def test_productivity_stats(self, api_client, auth_headers):
        r = api_client.get(f"{BASE_URL}/api/productivity/stats", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        s = r.json()
        for k in ["total_patients", "total_hours", "total_revenue", "avg_pph", "avg_rpp", "days_logged"]:
            assert k in s


# ---------- Dashboard ----------
class TestDashboard:
    def test_dashboard_aggregates(self, api_client, auth_headers):
        r = api_client.get(f"{BASE_URL}/api/dashboard", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        d = r.json()
        for section in ["personal", "hospital", "productivity"]:
            assert section in d
        # demo user should have data after seeding
        assert d["personal"]["loans_count"] >= 1
        assert d["personal"]["investments_count"] >= 1


# ---------- Seed ----------
class TestSeed:
    def test_seed_demo(self, api_client, auth_headers):
        r = api_client.post(f"{BASE_URL}/api/seed/demo", headers=auth_headers, timeout=30)
        assert r.status_code == 200
        assert r.json()["status"] == "seeded"
        # verify data exists
        dash = api_client.get(f"{BASE_URL}/api/dashboard", headers=auth_headers, timeout=15).json()
        assert dash["personal"]["loans_count"] == 2
        assert dash["personal"]["investments_count"] == 3
        assert dash["hospital"]["months_tracked"] == 6


# ---------- AI Insights ----------
class TestAIInsights:
    def test_insights_returns_reply(self, api_client, auth_headers):
        r = api_client.post(f"{BASE_URL}/api/ai/insights", headers=auth_headers, json={
            "message": "How can I reduce my OPEX next month?",
        }, timeout=60)
        assert r.status_code == 200
        data = r.json()
        assert "reply" in data and isinstance(data["reply"], str) and len(data["reply"]) > 20
        assert "session_id" in data
