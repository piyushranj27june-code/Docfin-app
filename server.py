from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import bcrypt
import jwt
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Literal
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Auth config
JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = os.environ['JWT_ALGORITHM']
JWT_EXPIRE_MINUTES = int(os.environ['JWT_EXPIRE_MINUTES'])
EMERGENT_LLM_KEY = os.environ['EMERGENT_LLM_KEY']

app = FastAPI()
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# ---------- Models ----------

class UserRegister(BaseModel):
    email: EmailStr
    password: str
    name: str
    specialty: Optional[str] = "General Practitioner"
    hospital: Optional[str] = ""

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserOut(BaseModel):
    id: str
    email: str
    name: str
    specialty: str
    hospital: str

class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut

class ExpenseCreate(BaseModel):
    description: str
    amount: float
    date: Optional[str] = None  # ISO date
    category: Optional[str] = None  # if blank, AI categorizes

class Expense(BaseModel):
    id: str
    user_id: str
    description: str
    amount: float
    category: str
    date: str
    ai_categorized: bool

class LoanCreate(BaseModel):
    name: str
    principal: float
    rate: float        # annual %
    tenure_months: int

class Loan(BaseModel):
    id: str
    user_id: str
    name: str
    principal: float
    rate: float
    tenure_months: int
    emi: float
    total_interest: float
    total_payable: float

class InvestmentCreate(BaseModel):
    name: str
    type: Literal["SIP", "FD", "Stocks", "MutualFund", "PPF", "NPS", "Other"]
    amount: float
    monthly_contribution: float = 0
    expected_return: float = 12.0  # annual %
    current_value: Optional[float] = None

class Investment(BaseModel):
    id: str
    user_id: str
    name: str
    type: str
    amount: float
    monthly_contribution: float
    expected_return: float
    current_value: float

class TaxInput(BaseModel):
    gross_income: float       # annual
    deduction_80c: float = 0  # PF, ELSS, LIC
    deduction_80d: float = 0  # medical insurance
    home_loan_interest: float = 0  # section 24
    nps_80ccd1b: float = 0    # extra 50k
    standard_deduction: float = 75000  # new regime FY25, 50k old
    hra_exempt: float = 0
    professional_tax: float = 2400

class TaxResult(BaseModel):
    old_regime_tax: float
    new_regime_tax: float
    old_regime_taxable: float
    new_regime_taxable: float
    recommended: str
    savings: float
    breakdown_old: dict
    breakdown_new: dict

class HospitalRevenueCreate(BaseModel):
    month: str  # YYYY-MM
    opd_revenue: float
    ipd_revenue: float
    pharmacy_revenue: float
    lab_revenue: float
    other_revenue: float = 0
    operating_costs: float
    staff_costs: float
    notes: Optional[str] = ""

class HospitalRevenue(BaseModel):
    id: str
    user_id: str
    month: str
    opd_revenue: float
    ipd_revenue: float
    pharmacy_revenue: float
    lab_revenue: float
    other_revenue: float
    operating_costs: float
    staff_costs: float
    total_revenue: float
    net_cashflow: float
    notes: str

class ProductivityCreate(BaseModel):
    date: str          # YYYY-MM-DD
    patients_seen: int
    hours_worked: float
    revenue_generated: float
    procedures: int = 0
    notes: Optional[str] = ""

class Productivity(BaseModel):
    id: str
    user_id: str
    date: str
    patients_seen: int
    hours_worked: float
    revenue_generated: float
    procedures: int
    notes: str
    patients_per_hour: float
    revenue_per_patient: float

class ChatMessage(BaseModel):
    message: str
    session_id: Optional[str] = None

class ChatResponse(BaseModel):
    reply: str
    session_id: str

class EMICalcInput(BaseModel):
    principal: float
    rate: float
    tenure_months: int

class PrepayVsInvestInput(BaseModel):
    principal: float          # remaining loan principal
    rate: float               # loan annual rate %
    tenure_months: int        # remaining loan tenure in months
    lump_sum: float           # money available to either prepay or invest
    invest_return: float = 12 # expected annual % return on investment

# ---------- Helpers ----------

def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False

def create_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRE_MINUTES),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(creds: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def calc_emi(principal: float, rate_pa: float, tenure_months: int) -> dict:
    if tenure_months <= 0 or principal <= 0:
        return {"emi": 0, "total_interest": 0, "total_payable": 0}
    r = (rate_pa / 12.0) / 100.0
    if r == 0:
        emi = principal / tenure_months
    else:
        emi = principal * r * ((1 + r) ** tenure_months) / (((1 + r) ** tenure_months) - 1)
    total = emi * tenure_months
    return {
        "emi": round(emi, 2),
        "total_interest": round(total - principal, 2),
        "total_payable": round(total, 2),
    }

def india_tax_new_regime(taxable: float) -> float:
    """FY 2025-26 new regime slabs (in INR)."""
    slabs = [
        (400000, 0.00),
        (800000, 0.05),
        (1200000, 0.10),
        (1600000, 0.15),
        (2000000, 0.20),
        (2400000, 0.25),
        (float("inf"), 0.30),
    ]
    return _slab_tax(taxable, slabs)

def india_tax_old_regime(taxable: float) -> float:
    """Old regime slabs for individuals < 60."""
    slabs = [
        (250000, 0.00),
        (500000, 0.05),
        (1000000, 0.20),
        (float("inf"), 0.30),
    ]
    tax = _slab_tax(taxable, slabs)
    # 87A rebate if taxable <= 5L
    if taxable <= 500000:
        tax = max(0, tax - 12500)
    return tax

def _slab_tax(taxable: float, slabs) -> float:
    if taxable <= 0:
        return 0
    tax = 0
    prev = 0
    for limit, rate in slabs:
        if taxable > limit:
            tax += (limit - prev) * rate
            prev = limit
        else:
            tax += (taxable - prev) * rate
            break
    return tax

async def ai_chat(system_msg: str, user_text: str, session_id: str) -> str:
    """Call Claude Sonnet 4.5 via emergentintegrations."""
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=system_msg,
    ).with_model("anthropic", "claude-sonnet-4-5-20250929")
    response = await chat.send_message(UserMessage(text=user_text))
    return response if isinstance(response, str) else str(response)

# ---------- Routes ----------

@api_router.get("/")
async def root():
    return {"message": "Doctor Finance AI API", "status": "ok"}

# --- Auth ---
@api_router.post("/auth/register", response_model=TokenOut)
async def register(payload: UserRegister):
    existing = await db.users.find_one({"email": payload.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": payload.email.lower(),
        "password": hash_password(payload.password),
        "name": payload.name,
        "specialty": payload.specialty or "General Practitioner",
        "hospital": payload.hospital or "",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user_doc)
    token = create_token(user_id)
    return TokenOut(
        access_token=token,
        user=UserOut(
            id=user_id, email=user_doc["email"], name=user_doc["name"],
            specialty=user_doc["specialty"], hospital=user_doc["hospital"]
        )
    )

@api_router.post("/auth/login", response_model=TokenOut)
async def login(payload: UserLogin):
    user = await db.users.find_one({"email": payload.email.lower()})
    if not user or not verify_password(payload.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_token(user["id"])
    return TokenOut(
        access_token=token,
        user=UserOut(
            id=user["id"], email=user["email"], name=user["name"],
            specialty=user.get("specialty", ""), hospital=user.get("hospital", "")
        )
    )

@api_router.get("/auth/me", response_model=UserOut)
async def me(current_user: dict = Depends(get_current_user)):
    return UserOut(
        id=current_user["id"], email=current_user["email"], name=current_user["name"],
        specialty=current_user.get("specialty", ""), hospital=current_user.get("hospital", "")
    )

# --- Expenses + AI categorization ---
EXPENSE_CATEGORIES = [
    "Food & Dining", "Transportation", "Housing & Rent", "Utilities",
    "Medical Equipment", "Continuing Education", "Insurance", "Investments",
    "Loan EMI", "Entertainment", "Shopping", "Travel", "Healthcare", "Other"
]

async def categorize_expense_ai(description: str, amount: float, user_id: str) -> str:
    try:
        prompt = (
            f"Classify this expense into exactly ONE category from this list: "
            f"{', '.join(EXPENSE_CATEGORIES)}.\n"
            f"Expense: '{description}' - ₹{amount}\n"
            f"Respond with only the category name, nothing else."
        )
        reply = await ai_chat(
            system_msg="You are an expense categorization assistant for a young doctor. "
                       "Respond with ONLY the category name from the provided list.",
            user_text=prompt,
            session_id=f"categorize-{user_id}",
        )
        reply = reply.strip().strip(".").strip('"').strip()
        # match to known category
        for c in EXPENSE_CATEGORIES:
            if c.lower() == reply.lower() or c.lower() in reply.lower():
                return c
        return "Other"
    except Exception as e:
        logger.warning(f"AI categorization failed: {e}")
        return "Other"

@api_router.post("/expenses", response_model=Expense)
async def add_expense(payload: ExpenseCreate, current_user: dict = Depends(get_current_user)):
    cat = payload.category
    ai_cat = False
    if not cat:
        cat = await categorize_expense_ai(payload.description, payload.amount, current_user["id"])
        ai_cat = True
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "description": payload.description,
        "amount": payload.amount,
        "category": cat,
        "date": payload.date or datetime.now(timezone.utc).date().isoformat(),
        "ai_categorized": ai_cat,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.expenses.insert_one(doc)
    doc.pop("_id", None)
    return Expense(**{k: doc[k] for k in Expense.model_fields.keys()})

@api_router.get("/expenses", response_model=List[Expense])
async def list_expenses(current_user: dict = Depends(get_current_user), limit: int = 100):
    rows = await db.expenses.find(
        {"user_id": current_user["id"]}, {"_id": 0}
    ).sort("date", -1).to_list(limit)
    return [Expense(**{k: r.get(k) for k in Expense.model_fields.keys()}) for r in rows]

@api_router.delete("/expenses/{expense_id}")
async def delete_expense(expense_id: str, current_user: dict = Depends(get_current_user)):
    res = await db.expenses.delete_one({"id": expense_id, "user_id": current_user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Expense not found")
    return {"status": "deleted"}

@api_router.get("/expenses/summary")
async def expense_summary(current_user: dict = Depends(get_current_user)):
    rows = await db.expenses.find({"user_id": current_user["id"]}, {"_id": 0}).to_list(1000)
    by_cat = {}
    total = 0.0
    month_total = 0.0
    cur_month = datetime.now(timezone.utc).strftime("%Y-%m")
    for r in rows:
        amt = float(r.get("amount", 0))
        cat = r.get("category", "Other")
        by_cat[cat] = by_cat.get(cat, 0.0) + amt
        total += amt
        if r.get("date", "").startswith(cur_month):
            month_total += amt
    return {
        "total": round(total, 2),
        "month_total": round(month_total, 2),
        "count": len(rows),
        "by_category": [{"category": k, "amount": round(v, 2)} for k, v in sorted(by_cat.items(), key=lambda x: -x[1])],
    }

# --- Loans + EMI ---
@api_router.post("/loans/calculate")
async def calculate_emi(payload: EMICalcInput):
    return calc_emi(payload.principal, payload.rate, payload.tenure_months)

@api_router.post("/loans", response_model=Loan)
async def add_loan(payload: LoanCreate, current_user: dict = Depends(get_current_user)):
    emi_data = calc_emi(payload.principal, payload.rate, payload.tenure_months)
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "name": payload.name,
        "principal": payload.principal,
        "rate": payload.rate,
        "tenure_months": payload.tenure_months,
        "emi": emi_data["emi"],
        "total_interest": emi_data["total_interest"],
        "total_payable": emi_data["total_payable"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.loans.insert_one(doc)
    doc.pop("_id", None)
    return Loan(**{k: doc[k] for k in Loan.model_fields.keys()})

@api_router.get("/loans", response_model=List[Loan])
async def list_loans(current_user: dict = Depends(get_current_user)):
    rows = await db.loans.find({"user_id": current_user["id"]}, {"_id": 0}).to_list(100)
    return [Loan(**{k: r.get(k) for k in Loan.model_fields.keys()}) for r in rows]

@api_router.delete("/loans/{loan_id}")
async def delete_loan(loan_id: str, current_user: dict = Depends(get_current_user)):
    res = await db.loans.delete_one({"id": loan_id, "user_id": current_user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return {"status": "deleted"}

# --- Investments ---
@api_router.post("/investments", response_model=Investment)
async def add_investment(payload: InvestmentCreate, current_user: dict = Depends(get_current_user)):
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "name": payload.name,
        "type": payload.type,
        "amount": payload.amount,
        "monthly_contribution": payload.monthly_contribution,
        "expected_return": payload.expected_return,
        "current_value": payload.current_value if payload.current_value is not None else payload.amount,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.investments.insert_one(doc)
    doc.pop("_id", None)
    return Investment(**{k: doc[k] for k in Investment.model_fields.keys()})

@api_router.get("/investments", response_model=List[Investment])
async def list_investments(current_user: dict = Depends(get_current_user)):
    rows = await db.investments.find({"user_id": current_user["id"]}, {"_id": 0}).to_list(100)
    return [Investment(**{k: r.get(k) for k in Investment.model_fields.keys()}) for r in rows]

@api_router.delete("/investments/{inv_id}")
async def delete_investment(inv_id: str, current_user: dict = Depends(get_current_user)):
    res = await db.investments.delete_one({"id": inv_id, "user_id": current_user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return {"status": "deleted"}

@api_router.post("/investments/sip-calc")
async def sip_calculator(monthly: float, years: int, rate: float):
    """Future value of SIP."""
    if monthly <= 0 or years <= 0:
        return {"future_value": 0, "invested": 0, "gain": 0}
    n = years * 12
    r = rate / 12 / 100
    if r == 0:
        fv = monthly * n
    else:
        fv = monthly * (((1 + r) ** n - 1) / r) * (1 + r)
    invested = monthly * n
    return {
        "future_value": round(fv, 2),
        "invested": round(invested, 2),
        "gain": round(fv - invested, 2),
    }

@api_router.post("/planning/prepay-vs-invest")
async def prepay_vs_invest(payload: PrepayVsInvestInput):
    """Compare: lump-sum loan prepayment vs investing the same amount.

    Method: keep EMI constant. Prepayment shortens the loan tenure;
    interest_saved = original_total_interest - new_total_interest.
    Invest scenario: lump_sum compounds at invest_return for the same
    *remaining loan tenure* (apples-to-apples horizon).
    """
    import math
    P = max(payload.principal, 0)
    rate_pa = max(payload.rate, 0)
    n = max(payload.tenure_months, 0)
    L = max(payload.lump_sum, 0)
    inv_r = max(payload.invest_return, 0)

    if P <= 0 or n <= 0 or L <= 0:
        raise HTTPException(status_code=400, detail="principal, tenure_months and lump_sum must be > 0")

    r = (rate_pa / 12) / 100  # monthly rate
    # original EMI on remaining principal
    if r == 0:
        emi = P / n
        orig_total_interest = 0.0
    else:
        emi = P * r * ((1 + r) ** n) / (((1 + r) ** n) - 1)
        orig_total_interest = emi * n - P

    if L >= P:
        # full payoff
        new_principal = 0.0
        new_tenure = 0
        new_total_interest = 0.0
    else:
        new_principal = P - L
        if r == 0:
            new_tenure = math.ceil(new_principal / emi)
            new_total_interest = 0.0
        else:
            # n_new = -log(1 - (P_new * r) / EMI) / log(1 + r)
            ratio = (new_principal * r) / emi
            if ratio >= 1:
                new_tenure = n  # safety
            else:
                n_new = -math.log(1 - ratio) / math.log(1 + r)
                new_tenure = math.ceil(n_new)
            new_total_interest = emi * new_tenure - new_principal

    months_saved = max(n - new_tenure, 0)
    interest_saved = max(orig_total_interest - new_total_interest, 0)

    # Invest the lump sum for the original remaining tenure (same horizon)
    years_horizon = n / 12.0
    inv_monthly_rate = (inv_r / 12) / 100
    if inv_monthly_rate == 0:
        future_value = L
    else:
        future_value = L * ((1 + inv_monthly_rate) ** n)
    investment_gain = future_value - L

    # Net benefit of prepay vs invest (after the same horizon).
    # Prepay benefit: interest saved + any "freed cashflow" you could reinvest after payoff.
    # Keep it simple: compare interest_saved to investment_gain.
    prepay_better = interest_saved >= investment_gain
    recommendation = "Prepay" if prepay_better else "Invest"
    net_benefit = abs(interest_saved - investment_gain)

    # Break-even investment return: the rate at which invest_gain == interest_saved
    # FV = L*(1+r/12)^n  ⇒  (1+r/12)^n = (L+interest_saved)/L
    if L > 0 and n > 0 and interest_saved > 0:
        target_multiple = (L + interest_saved) / L
        monthly_be = target_multiple ** (1 / n) - 1
        break_even_return = monthly_be * 12 * 100
    else:
        break_even_return = 0.0

    return {
        "emi": round(emi, 2),
        "original_tenure_months": n,
        "original_total_interest": round(orig_total_interest, 2),
        "prepay": {
            "new_principal": round(new_principal, 2),
            "new_tenure_months": int(new_tenure),
            "months_saved": int(months_saved),
            "new_total_interest": round(new_total_interest, 2),
            "interest_saved": round(interest_saved, 2),
        },
        "invest": {
            "lump_sum": round(L, 2),
            "future_value": round(future_value, 2),
            "gain": round(investment_gain, 2),
            "horizon_months": n,
        },
        "recommendation": recommendation,
        "net_benefit": round(net_benefit, 2),
        "break_even_return": round(break_even_return, 2),
    }

# --- Tax planning ---
@api_router.post("/tax/calculate", response_model=TaxResult)
async def tax_calculate(payload: TaxInput):
    gross = payload.gross_income

    # Old regime taxable
    old_std = 50000
    old_deductions = (
        old_std + payload.professional_tax + payload.hra_exempt
        + min(payload.deduction_80c, 150000)
        + min(payload.deduction_80d, 25000)
        + min(payload.home_loan_interest, 200000)
        + min(payload.nps_80ccd1b, 50000)
    )
    old_taxable = max(0, gross - old_deductions)
    old_tax = india_tax_old_regime(old_taxable)
    old_tax_w_cess = old_tax * 1.04  # 4% health & education cess

    # New regime taxable (FY25-26: std deduction 75k, no 80C/80D/HRA)
    new_std = 75000
    new_deductions = new_std + min(payload.nps_80ccd1b, 50000)  # NPS employer-only normally; allow 1B
    new_taxable = max(0, gross - new_deductions)
    new_tax = india_tax_new_regime(new_taxable)
    # 87A rebate under new regime: full rebate up to 12L taxable
    if new_taxable <= 1200000:
        new_tax = 0
    new_tax_w_cess = new_tax * 1.04

    recommended = "New Regime" if new_tax_w_cess < old_tax_w_cess else "Old Regime"
    savings = abs(new_tax_w_cess - old_tax_w_cess)

    return TaxResult(
        old_regime_tax=round(old_tax_w_cess, 2),
        new_regime_tax=round(new_tax_w_cess, 2),
        old_regime_taxable=round(old_taxable, 2),
        new_regime_taxable=round(new_taxable, 2),
        recommended=recommended,
        savings=round(savings, 2),
        breakdown_old={
            "standard_deduction": old_std,
            "section_80c": min(payload.deduction_80c, 150000),
            "section_80d": min(payload.deduction_80d, 25000),
            "home_loan_24b": min(payload.home_loan_interest, 200000),
            "nps_80ccd1b": min(payload.nps_80ccd1b, 50000),
            "hra": payload.hra_exempt,
            "professional_tax": payload.professional_tax,
            "total_deductions": round(old_deductions, 2),
        },
        breakdown_new={
            "standard_deduction": new_std,
            "nps_80ccd1b": min(payload.nps_80ccd1b, 50000),
            "total_deductions": round(new_deductions, 2),
        },
    )

# --- Hospital revenue ---
@api_router.post("/hospital/revenue", response_model=HospitalRevenue)
async def add_revenue(payload: HospitalRevenueCreate, current_user: dict = Depends(get_current_user)):
    total = payload.opd_revenue + payload.ipd_revenue + payload.pharmacy_revenue + payload.lab_revenue + payload.other_revenue
    net = total - payload.operating_costs - payload.staff_costs
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "month": payload.month,
        "opd_revenue": payload.opd_revenue,
        "ipd_revenue": payload.ipd_revenue,
        "pharmacy_revenue": payload.pharmacy_revenue,
        "lab_revenue": payload.lab_revenue,
        "other_revenue": payload.other_revenue,
        "operating_costs": payload.operating_costs,
        "staff_costs": payload.staff_costs,
        "total_revenue": round(total, 2),
        "net_cashflow": round(net, 2),
        "notes": payload.notes or "",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.hospital_revenue.insert_one(doc)
    doc.pop("_id", None)
    return HospitalRevenue(**{k: doc[k] for k in HospitalRevenue.model_fields.keys()})

@api_router.get("/hospital/revenue", response_model=List[HospitalRevenue])
async def list_revenue(current_user: dict = Depends(get_current_user)):
    rows = await db.hospital_revenue.find({"user_id": current_user["id"]}, {"_id": 0}).sort("month", -1).to_list(100)
    return [HospitalRevenue(**{k: r.get(k) for k in HospitalRevenue.model_fields.keys()}) for r in rows]

@api_router.delete("/hospital/revenue/{rev_id}")
async def delete_revenue(rev_id: str, current_user: dict = Depends(get_current_user)):
    res = await db.hospital_revenue.delete_one({"id": rev_id, "user_id": current_user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return {"status": "deleted"}

@api_router.get("/hospital/leakage")
async def detect_leakage(current_user: dict = Depends(get_current_user)):
    """Compare month-over-month for anomalies."""
    rows = await db.hospital_revenue.find({"user_id": current_user["id"]}, {"_id": 0}).sort("month", 1).to_list(100)
    alerts = []
    for i in range(1, len(rows)):
        prev = rows[i - 1]
        cur = rows[i]
        # revenue drop > 15%
        if prev["total_revenue"] > 0:
            change = (cur["total_revenue"] - prev["total_revenue"]) / prev["total_revenue"] * 100
            if change < -15:
                alerts.append({
                    "month": cur["month"],
                    "type": "Revenue Drop",
                    "severity": "high",
                    "message": f"Total revenue dropped {abs(change):.1f}% vs {prev['month']}",
                })
        # cost spike > 20%
        prev_cost = prev["operating_costs"] + prev["staff_costs"]
        cur_cost = cur["operating_costs"] + cur["staff_costs"]
        if prev_cost > 0:
            cchange = (cur_cost - prev_cost) / prev_cost * 100
            if cchange > 20:
                alerts.append({
                    "month": cur["month"],
                    "type": "Cost Spike",
                    "severity": "medium",
                    "message": f"Costs rose {cchange:.1f}% vs {prev['month']}",
                })
        # negative cashflow
        if cur["net_cashflow"] < 0:
            alerts.append({
                "month": cur["month"],
                "type": "Negative Cashflow",
                "severity": "high",
                "message": f"Net cashflow is ₹{cur['net_cashflow']:,.0f}",
            })
    return {"alerts": alerts, "months_analyzed": len(rows)}

# --- Productivity ---
@api_router.post("/productivity", response_model=Productivity)
async def add_productivity(payload: ProductivityCreate, current_user: dict = Depends(get_current_user)):
    pph = payload.patients_seen / payload.hours_worked if payload.hours_worked > 0 else 0
    rpp = payload.revenue_generated / payload.patients_seen if payload.patients_seen > 0 else 0
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "date": payload.date,
        "patients_seen": payload.patients_seen,
        "hours_worked": payload.hours_worked,
        "revenue_generated": payload.revenue_generated,
        "procedures": payload.procedures,
        "notes": payload.notes or "",
        "patients_per_hour": round(pph, 2),
        "revenue_per_patient": round(rpp, 2),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.productivity.insert_one(doc)
    doc.pop("_id", None)
    return Productivity(**{k: doc[k] for k in Productivity.model_fields.keys()})

@api_router.get("/productivity", response_model=List[Productivity])
async def list_productivity(current_user: dict = Depends(get_current_user)):
    rows = await db.productivity.find({"user_id": current_user["id"]}, {"_id": 0}).sort("date", -1).to_list(100)
    return [Productivity(**{k: r.get(k) for k in Productivity.model_fields.keys()}) for r in rows]

@api_router.delete("/productivity/{pid}")
async def delete_productivity(pid: str, current_user: dict = Depends(get_current_user)):
    res = await db.productivity.delete_one({"id": pid, "user_id": current_user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return {"status": "deleted"}

@api_router.get("/productivity/stats")
async def productivity_stats(current_user: dict = Depends(get_current_user)):
    rows = await db.productivity.find({"user_id": current_user["id"]}, {"_id": 0}).to_list(1000)
    if not rows:
        return {"total_patients": 0, "total_hours": 0, "total_revenue": 0, "avg_pph": 0, "avg_rpp": 0, "days_logged": 0}
    total_p = sum(r["patients_seen"] for r in rows)
    total_h = sum(r["hours_worked"] for r in rows)
    total_r = sum(r["revenue_generated"] for r in rows)
    return {
        "total_patients": total_p,
        "total_hours": round(total_h, 1),
        "total_revenue": round(total_r, 2),
        "avg_pph": round(total_p / total_h, 2) if total_h > 0 else 0,
        "avg_rpp": round(total_r / total_p, 2) if total_p > 0 else 0,
        "days_logged": len(rows),
    }

# --- AI Insights (hospital improvement suggestions) ---
@api_router.post("/ai/insights", response_model=ChatResponse)
async def ai_insights(payload: ChatMessage, current_user: dict = Depends(get_current_user)):
    session_id = payload.session_id or f"insights-{current_user['id']}"

    # Gather context: revenue, expenses, productivity
    revenue = await db.hospital_revenue.find({"user_id": current_user["id"]}, {"_id": 0}).sort("month", -1).limit(6).to_list(6)
    prod = await db.productivity.find({"user_id": current_user["id"]}, {"_id": 0}).sort("date", -1).limit(30).to_list(30)
    expenses = await db.expenses.find({"user_id": current_user["id"]}, {"_id": 0}).to_list(200)

    context = f"Doctor: {current_user.get('name')} ({current_user.get('specialty')})\n"
    context += f"Hospital: {current_user.get('hospital') or 'Independent practice'}\n\n"

    if revenue:
        context += "RECENT HOSPITAL REVENUE (last 6 months):\n"
        for r in revenue:
            context += f"  {r['month']}: Revenue ₹{r['total_revenue']:,.0f}, Net cashflow ₹{r['net_cashflow']:,.0f} (OPD ₹{r['opd_revenue']:,.0f}, IPD ₹{r['ipd_revenue']:,.0f}, Pharmacy ₹{r['pharmacy_revenue']:,.0f}, Lab ₹{r['lab_revenue']:,.0f}, Costs ₹{r['operating_costs'] + r['staff_costs']:,.0f})\n"
    if prod:
        total_p = sum(p["patients_seen"] for p in prod)
        total_h = sum(p["hours_worked"] for p in prod)
        context += f"\nPRODUCTIVITY (last {len(prod)} days): {total_p} patients in {total_h:.1f}h ({(total_p/total_h if total_h>0 else 0):.1f} patients/hr)\n"
    if expenses:
        ecat = {}
        for e in expenses:
            ecat[e['category']] = ecat.get(e['category'], 0) + e['amount']
        context += "\nPERSONAL EXPENSE CATEGORIES:\n"
        for cat, amt in sorted(ecat.items(), key=lambda x: -x[1])[:5]:
            context += f"  {cat}: ₹{amt:,.0f}\n"

    system_msg = (
        "You are an experienced healthcare-finance consultant advising a young Indian doctor. "
        "Provide CONCISE, ACTIONABLE, NUMBERED insights focused on revenue growth, leakage reduction, "
        "tax efficiency (Indian context), and productivity. Use ₹ for currency. "
        "Be warm, encouraging, but direct. Limit to 4-6 short bullet points unless asked for detail."
    )
    user_text = f"{context}\n\nDoctor's question: {payload.message}"

    try:
        reply = await ai_chat(system_msg, user_text, session_id)
    except Exception as e:
        logger.error(f"AI insights error: {e}")
        reply = ("I couldn't reach the AI service right now. Based on your data, focus on:\n"
                 "1. Reduce operating costs by negotiating supplier contracts\n"
                 "2. Increase OPD revenue with better appointment scheduling\n"
                 "3. Maximize 80C/80D deductions for tax savings\n"
                 "4. Track patient-per-hour to identify peak productivity windows")
    return ChatResponse(reply=reply, session_id=session_id)

# --- Dashboard ---
@api_router.get("/dashboard")
async def dashboard(current_user: dict = Depends(get_current_user)):
    uid = current_user["id"]
    # Expenses month
    cur_month = datetime.now(timezone.utc).strftime("%Y-%m")
    exp_rows = await db.expenses.find({"user_id": uid}, {"_id": 0}).to_list(1000)
    month_exp = sum(e["amount"] for e in exp_rows if e.get("date", "").startswith(cur_month))
    total_exp = sum(e["amount"] for e in exp_rows)

    # Loans
    loans = await db.loans.find({"user_id": uid}, {"_id": 0}).to_list(50)
    total_emi = sum(l["emi"] for l in loans)
    total_loan_outstanding = sum(l["principal"] for l in loans)

    # Investments
    invs = await db.investments.find({"user_id": uid}, {"_id": 0}).to_list(50)
    total_invested = sum(i["amount"] for i in invs)
    portfolio_value = sum(i["current_value"] for i in invs)
    monthly_sip = sum(i["monthly_contribution"] for i in invs)

    # Hospital
    rev = await db.hospital_revenue.find({"user_id": uid}, {"_id": 0}).sort("month", -1).to_list(12)
    cur_rev_month = rev[0] if rev else None

    # Productivity (last 30d)
    prod = await db.productivity.find({"user_id": uid}, {"_id": 0}).sort("date", -1).limit(30).to_list(30)
    total_patients = sum(p["patients_seen"] for p in prod)
    total_hours = sum(p["hours_worked"] for p in prod)

    return {
        "month": cur_month,
        "personal": {
            "expenses_this_month": round(month_exp, 2),
            "total_expenses": round(total_exp, 2),
            "monthly_emi": round(total_emi, 2),
            "total_loan_outstanding": round(total_loan_outstanding, 2),
            "portfolio_value": round(portfolio_value, 2),
            "total_invested": round(total_invested, 2),
            "monthly_sip": round(monthly_sip, 2),
            "loans_count": len(loans),
            "investments_count": len(invs),
        },
        "hospital": {
            "latest_month_revenue": cur_rev_month["total_revenue"] if cur_rev_month else 0,
            "latest_month_cashflow": cur_rev_month["net_cashflow"] if cur_rev_month else 0,
            "latest_month": cur_rev_month["month"] if cur_rev_month else None,
            "months_tracked": len(rev),
        },
        "productivity": {
            "patients_30d": total_patients,
            "hours_30d": round(total_hours, 1),
            "patients_per_hour": round(total_patients / total_hours, 2) if total_hours > 0 else 0,
            "days_logged": len(prod),
        },
    }

# --- Seed demo data ---
@api_router.post("/seed/demo")
async def seed_demo(current_user: dict = Depends(get_current_user)):
    """Seed demo data for the current user (idempotent: clears + re-seeds user's data)."""
    uid = current_user["id"]
    await db.expenses.delete_many({"user_id": uid})
    await db.loans.delete_many({"user_id": uid})
    await db.investments.delete_many({"user_id": uid})
    await db.hospital_revenue.delete_many({"user_id": uid})
    await db.productivity.delete_many({"user_id": uid})

    today = datetime.now(timezone.utc).date()
    # Expenses
    sample_expenses = [
        ("Stethoscope replacement", 4500, "Medical Equipment"),
        ("Online CME course - cardiology", 8000, "Continuing Education"),
        ("Petrol", 3200, "Transportation"),
        ("Apartment rent", 35000, "Housing & Rent"),
        ("Grocery store", 6800, "Food & Dining"),
        ("Dinner with colleagues", 2400, "Food & Dining"),
        ("Electricity bill", 2100, "Utilities"),
        ("Term life insurance premium", 18000, "Insurance"),
        ("Netflix + Spotify", 800, "Entertainment"),
        ("Home loan EMI", 28500, "Loan EMI"),
    ]
    for i, (desc, amt, cat) in enumerate(sample_expenses):
        await db.expenses.insert_one({
            "id": str(uuid.uuid4()), "user_id": uid,
            "description": desc, "amount": amt, "category": cat,
            "date": (today - timedelta(days=i * 2)).isoformat(),
            "ai_categorized": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    # Loans
    home_emi = calc_emi(4500000, 8.5, 240)
    edu_emi = calc_emi(800000, 9.5, 84)
    await db.loans.insert_many([
        {"id": str(uuid.uuid4()), "user_id": uid, "name": "Home Loan",
         "principal": 4500000, "rate": 8.5, "tenure_months": 240, **home_emi,
         "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "user_id": uid, "name": "Medical Education Loan",
         "principal": 800000, "rate": 9.5, "tenure_months": 84, **edu_emi,
         "created_at": datetime.now(timezone.utc).isoformat()},
    ])

    # Investments
    await db.investments.insert_many([
        {"id": str(uuid.uuid4()), "user_id": uid, "name": "Axis Bluechip SIP", "type": "SIP",
         "amount": 60000, "monthly_contribution": 10000, "expected_return": 12.0,
         "current_value": 72000, "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "user_id": uid, "name": "PPF Account", "type": "PPF",
         "amount": 150000, "monthly_contribution": 12500, "expected_return": 7.1,
         "current_value": 158000, "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "user_id": uid, "name": "NPS Tier 1", "type": "NPS",
         "amount": 50000, "monthly_contribution": 4200, "expected_return": 10.0,
         "current_value": 54000, "created_at": datetime.now(timezone.utc).isoformat()},
    ])

    # Hospital Revenue (last 6 months)
    months = []
    cur = today.replace(day=1)
    for i in range(6):
        y = cur.year
        m = cur.month - i
        while m <= 0:
            m += 12
            y -= 1
        months.append(f"{y}-{m:02d}")
    months.reverse()
    base = 850000
    for i, mo in enumerate(months):
        variance = 1 + (i * 0.04) + ((-1) ** i) * 0.05
        total_rev = base * variance
        opd = total_rev * 0.45
        ipd = total_rev * 0.30
        pharm = total_rev * 0.12
        lab = total_rev * 0.10
        other = total_rev * 0.03
        op_cost = total_rev * 0.35
        staff = total_rev * 0.30
        await db.hospital_revenue.insert_one({
            "id": str(uuid.uuid4()), "user_id": uid, "month": mo,
            "opd_revenue": round(opd, 2), "ipd_revenue": round(ipd, 2),
            "pharmacy_revenue": round(pharm, 2), "lab_revenue": round(lab, 2),
            "other_revenue": round(other, 2),
            "operating_costs": round(op_cost, 2), "staff_costs": round(staff, 2),
            "total_revenue": round(opd + ipd + pharm + lab + other, 2),
            "net_cashflow": round(opd + ipd + pharm + lab + other - op_cost - staff, 2),
            "notes": "",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    # Productivity (last 14 days)
    for i in range(14):
        d = today - timedelta(days=i)
        patients = 18 + (i % 5) * 2
        hours = 8 + (i % 3) * 0.5
        revenue = patients * 1200
        await db.productivity.insert_one({
            "id": str(uuid.uuid4()), "user_id": uid, "date": d.isoformat(),
            "patients_seen": patients, "hours_worked": hours,
            "revenue_generated": revenue, "procedures": (i % 4),
            "notes": "",
            "patients_per_hour": round(patients / hours, 2),
            "revenue_per_patient": round(revenue / patients, 2),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    return {"status": "seeded", "user_id": uid}

# Register & middleware
app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
