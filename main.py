import os
import io
import json
import re
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Set, Tuple

from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, HTTPException, Query, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.websockets import WebSocketDisconnect
from pydantic import BaseModel, Field
from contextlib import asynccontextmanager

import uvicorn

# PDF reader
try:
    from pypdf import PdfReader
except ImportError:
    PdfReader = None

# Optional PyMuPDF for logo extraction (not required to run)
try:
    import fitz  # PyMuPDF
except ImportError:
    fitz = None

# MongoDB (Motor)
try:
    from motor.motor_asyncio import AsyncIOMotorClient
except ImportError:
    AsyncIOMotorClient = None

# OpenAI
try:
    from openai import OpenAI
except ImportError:
    OpenAI = None

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("africaesg")

# ================== CONFIG ==================
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL = os.getenv("OPENAI_MODEL_ESG", "gpt-4o-mini")
PORT = int(os.getenv("PORT", "3001"))

FRONTEND_ORIGINS_ENV = os.getenv("FRONTEND_ORIGINS")
if FRONTEND_ORIGINS_ENV:
    ALLOWED_ORIGINS = [o.strip() for o in FRONTEND_ORIGINS_ENV.split(",") if o.strip()]
else:
    ALLOWED_ORIGINS = [
        "http://localhost:5176",
        "http://127.0.0.1:5176",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

DATA_DIR = os.getenv("ESG_DATA_DIR", ".")
os.makedirs(DATA_DIR, exist_ok=True)

LAST_ESG_JSON_PATH = os.path.join(DATA_DIR, "last_esg_input.json")
LAST_ESG_ROWS_PATH = os.path.join(DATA_DIR, "last_esg_uploaded_rows.json")
LAST_INVOICES_JSON_PATH = os.path.join(DATA_DIR, "last_invoices.json")

MONGODB_URI = os.getenv("MONGODB_URI")  # optional
MONGODB_DB = os.getenv("MONGODB_DB", "esg_app")
MONGODB_COLLECTION = os.getenv("MONGODB_COLLECTION", "invoices")

# OpenAI client
openai_client = None
if OpenAI and OPENAI_API_KEY:
    openai_client = OpenAI(api_key=OPENAI_API_KEY)

# Mongo client (optional)
mongo_client = None
mongo_collection = None
if AsyncIOMotorClient and MONGODB_URI:
    try:
        mongo_client = AsyncIOMotorClient(MONGODB_URI)
        mongo_collection = mongo_client[MONGODB_DB][MONGODB_COLLECTION]
        logger.info("✅ MongoDB configured via Motor.")
    except Exception as e:
        mongo_client = None
        mongo_collection = None
        logger.warning(f"⚠️ MongoDB config failed, falling back to in-memory: {e}")

# ================== PERSISTENCE HELPERS ==================
def _safe_read_json(path: str, default: Any):
    if not os.path.exists(path):
        return default
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default

def _safe_write_json(path: str, data: Any):
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, default=str)
    except Exception as e:
        logger.warning(f"Failed to write JSON to {path}: {e}")

def now_iso() -> str:
    return datetime.utcnow().isoformat() + "Z"

def _model_dump(obj: Any) -> Dict[str, Any]:
    """
    Pydantic v1/v2 compatibility:
    - v2: model_dump()
    - v1: dict()
    """
    if obj is None:
        return {}
    if hasattr(obj, "model_dump"):
        return obj.model_dump()
    if hasattr(obj, "dict"):
        return obj.dict()
    return dict(obj)

def _safe_float(x: Any) -> Optional[float]:
    if x is None:
        return None
    try:
        if isinstance(x, str):
            x = x.replace(",", "").strip()
        return float(x)
    except Exception:
        return None

def _normalize_invoice(inv: Dict[str, Any]) -> Dict[str, Any]:
    """
    Ensures numeric fields are numeric, adds timestamps, and normalizes history.
    """
    out = dict(inv or {})
    for k in ["total_current_charges", "total_amount_due", "total_energy_kwh", "water_usage", "water_cost"]:
        if k in out:
            out[k] = _safe_float(out.get(k))

    if "sixMonthHistory" in out and isinstance(out["sixMonthHistory"], list):
        new_hist = []
        for row in out["sixMonthHistory"]:
            rr = dict(row or {})
            for hk in [
                "energyKWh",
                "total_current_charges",
                "total_amount_due",
                "maximum_demand_kva",
                "carbonTco2e",
                "water_m3",
                "water_cost",
            ]:
                if hk in rr:
                    rr[hk] = _safe_float(rr.get(hk))
            new_hist.append(rr)
        out["sixMonthHistory"] = new_hist

    out.setdefault("created_at", now_iso())
    out["updated_at"] = now_iso()
    return out

def _invoice_upsert_key(inv: Dict[str, Any]) -> Dict[str, Any]:
    """
    Stable upsert key for Mongo:
    Prefer tax_invoice_number. If missing, fallback to filename+invoice_date.
    """
    tin = inv.get("tax_invoice_number")
    if tin:
        return {"tax_invoice_number": tin}
    return {"filename": inv.get("filename"), "invoice_date": inv.get("invoice_date")}

# ================== MODELS ==================
class LoginRequest(BaseModel):
    email: str
    password: str

class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]

class ESGInput(BaseModel):
    company_name: str = Field(..., example="GreenBDG Africa")
    period: str = Field(..., example="2025-Q1")
    carbon_emissions_tons: float = Field(..., ge=0, example=18500.0)
    energy_consumption_mwh: float = Field(..., ge=0, example=1250.0)
    water_use_m3: float = Field(..., ge=0, example=55000.0)
    waste_generated_tons: float = Field(..., ge=0, example=180.0)
    fuel_litres: float = Field(0.0, ge=0, example=50000.0)
    social_score_raw: float = Field(..., ge=0, le=100, example=78.0)
    governance_score_raw: float = Field(..., ge=0, le=100, example=82.0)

class ESGScores(BaseModel):
    company_name: str
    period: str
    e_score: float
    s_score: float
    g_score: float
    overall_score: float
    methodology: Optional[Dict[str, str]] = None

class ESGInsights(BaseModel):
    overall: str
    environmental: List[str]
    social: List[str]
    governance: List[str]

class AnalyseResponse(BaseModel):
    scores: ESGScores
    insights: ESGInsights

class PlatformOverview(BaseModel):
    countries_supported: int
    esg_reports_generated: int
    compliance_accuracy: float
    ai_support_mode: str

class PillarInsightsResponse(BaseModel):
    metrics: Dict[str, Any]
    insights: List[str]
    live: Optional[bool] = None
    timestamp: Optional[str] = None

class SocialInsightsRequest(BaseModel):
    metrics: Dict[str, Any]

class GovernanceInsightsRequest(BaseModel):
    metrics: Dict[str, Any]

class ESGDataMock(BaseModel):
    summary: Dict[str, Any]
    metrics: Dict[str, Any]
    environmentalMetrics: Dict[str, Any]
    socialMetrics: Dict[str, Any]
    governanceMetrics: Dict[str, Any]

class ESGDataResponse(BaseModel):
    mockData: ESGDataMock
    insights: List[str]
    uploaded_date: Optional[str] = None

class InvoiceMonthHistory(BaseModel):
    month_label: Optional[str] = None
    energyKWh: Optional[float] = None
    total_current_charges: Optional[float] = None
    total_amount_due: Optional[float] = None
    maximum_demand_kva: Optional[float] = None
    carbonTco2e: Optional[float] = None
    water_m3: Optional[float] = None
    water_cost: Optional[float] = None

class InvoiceSummary(BaseModel):
    filename: str
    company_name: Optional[str] = None
    account_number: Optional[str] = None
    tax_invoice_number: Optional[str] = None
    invoice_date: Optional[str] = None
    due_date: Optional[str] = None
    total_current_charges: Optional[float] = None
    total_amount_due: Optional[float] = None
    total_energy_kwh: Optional[float] = None
    water_usage: Optional[float] = None
    water_cost: Optional[float] = None
    categories: List[str] = Field(default_factory=list)
    sixMonthHistory: List[InvoiceMonthHistory] = Field(default_factory=list)
    logo_base64: Optional[str] = None

class InvoiceUploadResponse(BaseModel):
    success: bool
    uploaded_count: int
    errors: List[str]
    invoices: List[Dict[str, Any]]

class InvoiceQueryResponse(BaseModel):
    items: List[Dict[str, Any]]
    total: int
    page: int
    page_size: int

class HealthResponse(BaseModel):
    status: str
    timestamp: str
    cors_origins: List[str]
    backend_port: int
    endpoints: List[str]
    frontend_urls: List[str]

class MongoDBSaveRequest(BaseModel):
    invoices: List[Dict[str, Any]]
    mongoDbName: str = "esg_app"

class MongoDBLoadResponse(BaseModel):
    success: bool
    invoices: List[Dict[str, Any]]
    count: int

class MongoDBClearResponse(BaseModel):
    success: bool
    message: str
    deleted_count: int = 0

class MongoDBStatsResponse(BaseModel):
    success: bool
    totalInvoices: int = 0
    totalEnergyKwh: float = 0.0
    estimatedCo2: float = 0.0
    lastUpdated: Optional[str] = None
    databaseName: str = "esg_app"

class EnvironmentalInsightsRequest(BaseModel):
    company_name: Optional[str] = None
    period: Optional[str] = None
    summary: Optional[Dict[str, Any]] = None
    metrics: Optional[Dict[str, Any]] = None
    invoice_baseline: Optional[Dict[str, Any]] = None

class MiniReportRequest(BaseModel):
    company_name: Optional[str] = None
    period: Optional[str] = None
    summary: Optional[Dict[str, Any]] = None
    metrics: Optional[Dict[str, Any]] = None
    invoice_baseline: Optional[Dict[str, Any]] = None

class MiniReportResponse(BaseModel):
    baseline: str
    benchmark: str
    performance_vs_benchmark: str
    ai_recommendations: List[str]
    live: bool = True
    timestamp: str

# ================== GLOBAL STATE (loaded from disk) ==================
last_esg_input: Dict[str, Any] = _safe_read_json(LAST_ESG_JSON_PATH, {})
last_esg_uploaded_rows: List[Dict[str, Any]] = _safe_read_json(LAST_ESG_ROWS_PATH, [])
last_invoice_summaries: List[Dict[str, Any]] = _safe_read_json(LAST_INVOICES_JSON_PATH, [])

# ================== LIVE AI (WebSocket Manager) ==================
class LiveAIManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        try:
            self.active_connections.remove(websocket)
        except ValueError:
            pass

    async def broadcast(self, message: Dict[str, Any]):
        dead = []
        for ws in self.active_connections:
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)

live_ai_manager = LiveAIManager()

# ================== HELPERS ==================
def generate_esg_mock_data() -> Dict[str, Any]:
    return {
        "summary": {
            "company": "AfricaESG Demo Corp",
            "reportPeriod": "2024-Q1",
            "overallScore": 72,
            "rating": "B",
            "lastUpdated": datetime.utcnow().isoformat(),
        },
        "metrics": {
            "carbonEmissions": 18500.0,
            "energyConsumption": 1250.0,
            "renewableEnergy": 15.5,
            "waterUsage": 55000.0,
            "wasteGenerated": 180.0,
            "recyclingRate": 65.0,
            "fuelConsumption": 50000.0,
            "supplierDiversity": 20.0,
            "employeeSatisfaction": 78.0,
            "communityInvestment": 250000.0,
            "boardDiversity": 35.0,
            "ethicsCompliance": 90.0,
            "transparencyScore": 82.0,
        },
        "environmentalMetrics": {
            "energyConsumption": "1,156,250 kWh",
            "renewableEnergy": "0.0%",
            "carbonEmissions": "18,500 t CO₂e",
            "monthlyAverage": "0 kWh",
            "peakConsumption": "0 kWh",
            "waterUsage": "12,500 m³",
            "waterEfficiency": "2.5 m³/unit",
        },
        "socialMetrics": {
            "supplierDiversity": 20.0,
            "employeeEngagement": 78.0,
            "communityPrograms": 8.0,
        },
        "governanceMetrics": {
            "corporateGovernance": "Strong",
            "iso9001Compliance": "ISO 9001 Certified",
            "boardIndependence": "60%",
            "ethicsViolations": "0",
            "auditFrequency": "Quarterly",
            "riskManagement": "Comprehensive",
            "governanceScore": 80,
            "supplierCompliance": 85,
            "auditCompletion": 92,
            "transparencyScore": 82,
        },
    }

def calculate_esg_scores(input_data: ESGInput) -> ESGScores:
    e_score = min(100, 100 - (input_data.carbon_emissions_tons / 1000) * 0.5)
    s_score = input_data.social_score_raw * 0.9 + 10
    g_score = input_data.governance_score_raw * 0.85 + 15
    overall_score = (e_score + s_score + g_score) / 3

    return ESGScores(
        company_name=input_data.company_name,
        period=input_data.period,
        e_score=round(e_score, 1),
        s_score=round(s_score, 1),
        g_score=round(g_score, 1),
        overall_score=round(overall_score, 1),
        methodology={
            "e_score": "Based on carbon intensity and resource efficiency",
            "s_score": "Based on social metrics and stakeholder engagement",
            "g_score": "Based on governance structure and compliance",
        },
    )

# ================== AI GENERATORS ==================
def _clean_lines_to_list(text: str) -> List[str]:
    lines = [ln.strip() for ln in (text or "").splitlines() if ln.strip()]
    cleaned = [re.sub(r"^[\-\*\d\.\)\s]+", "", ln).strip() for ln in lines]
    seen: Set[str] = set()
    out: List[str] = []
    for ln in cleaned:
        if ln and ln not in seen:
            seen.add(ln)
            out.append(ln)
    return out

def generate_ai_social_insights(metrics: Dict[str, Any]) -> List[str]:
    if not openai_client or not OPENAI_API_KEY:
        raise RuntimeError("OpenAI client not configured")

    system_prompt = (
        "You are an ESG and sustainability reporting assistant focused on the Social (S) pillar. "
        "Write short, board-level narrative insights for ESG dashboards and listed-company style reports. "
        "Tone: professional, neutral, concise; African context where relevant."
    )
    metrics_json = json.dumps(metrics, indent=2, default=str)
    user_prompt = (
        "Below is a JSON object containing a company's social metrics.\n\n"
        f"{metrics_json}\n\n"
        "Generate 4 to 7 concise insights for an ESG Social dashboard. "
        "Cover themes: employee engagement, human capital, safety, supplier diversity, community investment.\n\n"
        "Requirements:\n"
        "- Each insight must be 1–2 sentences.\n"
        "- Data-linked where possible.\n"
        "- Do NOT number and do NOT use bullet characters.\n"
        "- Return only insights separated by newlines."
    )

    completion = openai_client.chat.completions.create(
        model=OPENAI_MODEL,
        messages=[{"role": "system", "content": system_prompt},
                  {"role": "user", "content": user_prompt}],
        temperature=0.4,
        max_tokens=600,
    )
    out = _clean_lines_to_list(completion.choices[0].message.content or "")
    if not out:
        raise ValueError("Model returned empty insights")
    return out

def generate_ai_environmental_insights(metrics: Dict[str, Any]) -> List[str]:
    if not openai_client or not OPENAI_API_KEY:
        raise RuntimeError("OpenAI client not configured")

    system_prompt = (
        "You are an ESG and sustainability reporting assistant focused on the Environmental (E) pillar. "
        "Write short, board-level narrative insights for ESG dashboards and listed-company style reports. "
        "Tone: professional, neutral, concise; African context where relevant."
    )
    metrics_json = json.dumps(metrics, indent=2, default=str)
    user_prompt = (
        "Below is a JSON object containing a company's environmental metrics.\n\n"
        f"{metrics_json}\n\n"
        "Generate 4 to 7 concise insights for an ESG Environmental dashboard. "
        "Cover energy, emissions, water, waste, efficiency, renewables and transition/cost risk.\n\n"
        "Requirements:\n"
        "- Each insight must be 1–2 sentences.\n"
        "- Data-linked where possible.\n"
        "- Do NOT number and do NOT use bullet characters.\n"
        "- Return only insights separated by newlines."
    )

    completion = openai_client.chat.completions.create(
        model=OPENAI_MODEL,
        messages=[{"role": "system", "content": system_prompt},
                  {"role": "user", "content": user_prompt}],
        temperature=0.4,
        max_tokens=650,
    )
    out = _clean_lines_to_list(completion.choices[0].message.content or "")
    if not out:
        raise ValueError("Model returned empty insights")
    return out

def generate_ai_governance_insights(metrics: Dict[str, Any]) -> List[str]:
    if not openai_client or not OPENAI_API_KEY:
        raise RuntimeError("OpenAI client not configured")

    system_prompt = (
        "You are an ESG and sustainability reporting assistant focused on the Governance (G) pillar. "
        "Write short, board-level narrative insights for ESG dashboards and listed-company style reports. "
        "Tone: professional, neutral, concise; African context where relevant."
    )
    metrics_json = json.dumps(metrics, indent=2, default=str)
    user_prompt = (
        "Below is a JSON object containing a company's governance metrics.\n\n"
        f"{metrics_json}\n\n"
        "Generate 4 to 7 concise insights for an ESG Governance dashboard. "
        "Cover ethics/compliance, audits, board oversight/independence, transparency and risk oversight.\n\n"
        "Requirements:\n"
        "- Each insight must be 1–2 sentences.\n"
        "- Data-linked where possible.\n"
        "- Do NOT number and do NOT use bullet characters.\n"
        "- Return only insights separated by newlines."
    )

    completion = openai_client.chat.completions.create(
        model=OPENAI_MODEL,
        messages=[{"role": "system", "content": system_prompt},
                  {"role": "user", "content": user_prompt}],
        temperature=0.4,
        max_tokens=650,
    )
    out = _clean_lines_to_list(completion.choices[0].message.content or "")
    if not out:
        raise ValueError("Model returned empty insights")
    return out

def generate_ai_mini_report(payload: Dict[str, Any]) -> Dict[str, Any]:
    if not openai_client or not OPENAI_API_KEY:
        raise RuntimeError("OpenAI client not configured")

    system_prompt = (
        "You are an ESG analyst producing a concise mini-report for an ESG dashboard. "
        "Tone: board-level, neutral, specific, data-linked where possible, African context where relevant. "
        "Output MUST be valid JSON only."
    )

    safe_payload = {
        "company_name": payload.get("company_name"),
        "period": payload.get("period"),
        "summary": payload.get("summary") or {},
        "metrics": payload.get("metrics") or {},
        "invoice_baseline": payload.get("invoice_baseline") or {},
    }

    user_prompt = (
        "Using the following JSON payload (summary, KPI metrics, and invoice baseline if available), "
        "produce an ESG mini report.\n\n"
        f"{json.dumps(safe_payload, indent=2, default=str)}\n\n"
        "Return ONLY valid JSON with EXACT keys:\n"
        '{ "baseline": string, "benchmark": string, "performance_vs_benchmark": string, '
        '"ai_recommendations": [string, string, string, string] }\n'
        "Rules:\n"
        "- Keep each field concise.\n"
        "- Recommendations must be action-oriented (4 items).\n"
        "- No markdown, bullets, or extra keys.\n"
    )

    try:
        completion = openai_client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[{"role": "system", "content": system_prompt},
                      {"role": "user", "content": user_prompt}],
            temperature=0.35,
            max_tokens=700,
            response_format={"type": "json_object"},
        )
        raw = completion.choices[0].message.content or "{}"
        data = json.loads(raw)
    except Exception:
        completion = openai_client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[{"role": "system", "content": system_prompt},
                      {"role": "user", "content": user_prompt}],
            temperature=0.35,
            max_tokens=700,
        )
        raw = completion.choices[0].message.content or "{}"
        m = re.search(r"\{.*\}", raw, flags=re.DOTALL)
        data = json.loads(m.group(0)) if m else {}

    baseline = str(data.get("baseline", "")).strip()
    benchmark = str(data.get("benchmark", "")).strip()
    performance = str(data.get("performance_vs_benchmark", "")).strip()

    recs = data.get("ai_recommendations", [])
    if not isinstance(recs, list):
        recs = []

    cleaned_recs: List[str] = []
    for r in recs:
        s = re.sub(r"^[\-\*\d\.\)\s]+", "", str(r)).strip()
        if s:
            cleaned_recs.append(s)

    return {
        "baseline": baseline,
        "benchmark": benchmark,
        "performance_vs_benchmark": performance,
        "ai_recommendations": cleaned_recs[:6],
    }

def generate_dube_tradeport_data() -> Dict[str, Any]:
    return {
        "filename": "dube_tradeport_sample.pdf",
        "company_name": "Dube Tradeport",
        "account_number": "DTZ-2024-001",
        "tax_invoice_number": "INV-DTZ-2024-001",
        "invoice_date": "2024-01-15",
        "due_date": "2024-02-15",
        "total_current_charges": 185000.50,
        "total_amount_due": 185000.50,
        "total_energy_kwh": 125000.0,
        "water_usage": 12500.0,
        "water_cost": 75000.0,
        "categories": ["Manufacturing", "Logistics", "Industrial"],
        "sixMonthHistory": [
            {"month_label": "Jan 2024", "energyKWh": 21000.0, "total_current_charges": 31000.75, "total_amount_due": 31000.75, "carbonTco2e": 20.79, "water_m3": 2100.0, "water_cost": 12600.0},
            {"month_label": "Dec 2023", "energyKWh": 20500.0, "total_current_charges": 30300.50, "total_amount_due": 30300.50, "carbonTco2e": 20.30, "water_m3": 2050.0, "water_cost": 12300.0},
            {"month_label": "Nov 2023", "energyKWh": 19800.0, "total_current_charges": 29200.25, "total_amount_due": 29200.25, "carbonTco2e": 19.60, "water_m3": 1980.0, "water_cost": 11880.0},
            {"month_label": "Oct 2023", "energyKWh": 21500.0, "total_current_charges": 31700.80, "total_amount_due": 31700.80, "carbonTco2e": 21.29, "water_m3": 2150.0, "water_cost": 12900.0},
            {"month_label": "Sep 2023", "energyKWh": 20700.0, "total_current_charges": 30500.60, "total_amount_due": 30500.60, "carbonTco2e": 20.49, "water_m3": 2070.0, "water_cost": 12420.0},
            {"month_label": "Aug 2023", "energyKWh": 19500.0, "total_current_charges": 28700.45, "total_amount_due": 28700.45, "carbonTco2e": 19.31, "water_m3": 1950.0, "water_cost": 11700.0},
        ],
    }

def extract_invoice_data_from_pdf(file_content: bytes, filename: str) -> Dict[str, Any]:
    try:
        if PdfReader is None:
            raise ImportError("pypdf not installed")

        reader = PdfReader(io.BytesIO(file_content))
        text = ""
        for page in reader.pages:
            text += (page.extract_text() or "")

        # Try to extract a company name from the text content first (common invoice headers)
        company_name = None
        try:
            header_patterns = [
                r"(?:Company|Customer|Account Name|Account|Supplier|Billed To|Bill To|Sold To|Service Provider)[:\s]+([A-Z0-9&\-\.,'\(\)\s]{3,100})",
                r"(?:For|To)[:\s]+([A-Z0-9&\-\.,'\(\)\s]{3,100})",
            ]
            for p in header_patterns:
                m = re.search(p, text, re.IGNORECASE | re.MULTILINE)
                if m:
                    candidate = m.group(1).strip()
                    # avoid picking up things that look like numbers only
                    if re.search(r"[A-Za-z]", candidate):
                        company_name = re.sub(r"\s{2,}", " ", candidate)
                        break

            # Fallback: take the first non-empty line near the top that isn't 'Invoice' or similar
            if not company_name:
                lines = [ln.strip() for ln in (text or "").splitlines() if ln.strip()]
                for ln in lines[:12]:
                    if len(ln) > 2 and len(ln) < 80 and not re.search(r"invoice|tax|vat|date|total|account no|amount", ln, re.IGNORECASE):
                        if re.search(r"[A-Za-z]", ln):
                            company_name = re.sub(r"\s{2,}", " ", ln)
                            break
        except Exception:
            company_name = None

        # If no company name found in text, fallback to filename-derived name
        if not company_name:
            company_name = re.sub(r"\.pdf$", "", filename, flags=re.IGNORECASE)
            company_name = re.sub(r"[_-]", " ", company_name).title()

        energy_match = re.search(r"(\d{1,3}(?:,\d{3})*|\d+)\s*kWh", text, re.IGNORECASE)
        energy_kwh = float(energy_match.group(1).replace(",", "")) if energy_match else 125000.0

        water_match = re.search(r"Water.*?(\d{1,3}(?:,\d{3})*|\d+)\s*m³", text, re.IGNORECASE)
        water_m3 = float(water_match.group(1).replace(",", "")) if water_match else 12500.0

        charges_match = re.search(r"R\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)", text)
        charges = float(charges_match.group(1).replace(",", "")) if charges_match else 185000.50

        water_cost_match = re.search(
            r"Water.*?(?:cost|charge|amount).*?R\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)",
            text,
            re.IGNORECASE,
        )
        if not water_cost_match:
            water_cost_match = re.search(
                r"R\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?).*?Water",
                text,
                re.IGNORECASE,
            )
        water_cost = float(water_cost_match.group(1).replace(",", "")) if water_cost_match else 75000.0

        # company_name already set above (from text or filename fallback)

        months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"]
        history = []
        base_energy = energy_kwh / 6
        base_charges = charges / 6
        base_water = water_m3 / 6
        base_water_cost = water_cost / 6

        for i, m in enumerate(months):
            variance = 0.9 + (i * 0.05)
            month_energy = base_energy * variance
            month_charges = base_charges * variance
            month_water = base_water * variance
            month_water_cost = base_water_cost * variance
            month_carbon = month_energy * 0.99 / 1000

            history.append(
                {
                    "month_label": f"{m} 2024",
                    "energyKWh": round(month_energy, 2),
                    "total_current_charges": round(month_charges, 2),
                    "total_amount_due": round(month_charges, 2),
                    "carbonTco2e": round(month_carbon, 2),
                    "water_m3": round(month_water, 2),
                    "water_cost": round(month_water_cost, 2),
                }
            )

        return _normalize_invoice(
            {
                "filename": filename,
                "company_name": company_name,
                "account_number": f"ACC-{datetime.now().strftime('%Y%m%d')}",
                "tax_invoice_number": f"INV-{datetime.now().strftime('%Y%m%d-%H%M%S')}",
                "invoice_date": datetime.now().strftime("%Y-%m-%d"),
                "due_date": (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d"),
                "total_current_charges": round(charges, 2),
                "total_amount_due": round(charges, 2),
                "total_energy_kwh": round(energy_kwh, 2),
                "water_usage": round(water_m3, 2),
                "water_cost": round(water_cost, 2),
                "categories": ["Industrial", "Manufacturing"],
                "sixMonthHistory": history,
            }
        )

    except Exception as e:
        logger.error(f"Invoice extraction error: {e}")
        return _normalize_invoice(
            {
                "filename": filename,
                "company_name": "Extracted Company",
                "account_number": "ACC-FALLBACK",
                "tax_invoice_number": "INV-FALLBACK",
                "invoice_date": datetime.now().strftime("%Y-%m-%d"),
                "due_date": (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d"),
                "total_current_charges": 150000.0,
                "total_amount_due": 150000.0,
                "total_energy_kwh": 100000.0,
                "water_usage": 10000.0,
                "water_cost": 50000.0,
                "categories": ["Extracted"],
                "sixMonthHistory": [
                    {
                        "month_label": f"{month} 2024",
                        "energyKWh": 16666.67,
                        "total_current_charges": 25000.00,
                        "total_amount_due": 25000.00,
                        "carbonTco2e": 16.5,
                        "water_m3": 1666.67,
                        "water_cost": 8333.33,
                    }
                    for month in ["Jan", "Feb", "Mar", "Apr", "May", "Jun"]
                ],
            }
        )

# ================== LIVE SNAPSHOT ==================
async def build_live_snapshot() -> Dict[str, Any]:
    return {
        "timestamp": now_iso(),
        "last_esg_input": last_esg_input,
        "last_esg_uploaded_rows_count": len(last_esg_uploaded_rows),
        "invoice_count": len(last_invoice_summaries),
        "last_invoices": last_invoice_summaries[-6:],
    }

async def push_live_update():
    if not live_ai_manager.active_connections:
        return
    snapshot = await build_live_snapshot()
    await live_ai_manager.broadcast({"type": "live-esg-update", "data": snapshot})

# ================== MONGODB HELPERS ==================
async def mongo_upsert_invoice(inv: Dict[str, Any]) -> Optional[str]:
    if mongo_collection is None:
        return None
    inv = _normalize_invoice(inv)
    key = _invoice_upsert_key(inv)
    res = await mongo_collection.update_one(key, {"$set": inv}, upsert=True)
    if res.upserted_id:
        return str(res.upserted_id)
    return None

async def mongo_query_invoices(
    q: Optional[str],
    company: Optional[str],
    page: int,
    page_size: int,
    sort: str = "invoice_date_desc",
) -> Tuple[List[Dict[str, Any]], int]:
    """
    Query invoices. Uses MongoDB when configured, else filters in-memory list.
    """
    # fallback: in-memory if mongo isn't configured
    if mongo_collection is None:
        items = list(last_invoice_summaries)

        def matches(inv: Dict[str, Any]) -> bool:
            if company and company.lower() not in str(inv.get("company_name", "")).lower():
                return False
            if q:
                hay = " ".join(
                    [
                        str(inv.get("company_name", "")),
                        str(inv.get("filename", "")),
                        str(inv.get("tax_invoice_number", "")),
                        str(inv.get("account_number", "")),
                    ]
                ).lower()
                if q.lower() not in hay:
                    return False
            return True

        items = [i for i in items if matches(i)]
        total = len(items)

        reverse = sort in ("invoice_date_desc", "updated_at_desc")
        sort_field = "invoice_date" if sort.startswith("invoice_date") else "updated_at"
        items.sort(key=lambda x: str(x.get(sort_field) or ""), reverse=reverse)

        start = (page - 1) * page_size
        end = start + page_size
        return items[start:end], total

    query: Dict[str, Any] = {}
    if company:
        query["company_name"] = {"$regex": re.escape(company), "$options": "i"}
    if q:
        qrx = {"$regex": re.escape(q), "$options": "i"}
        query["$or"] = [
            {"company_name": qrx},
            {"filename": qrx},
            {"tax_invoice_number": qrx},
            {"account_number": qrx},
        ]

    sort_field, sort_dir = "invoice_date", -1
    if sort == "invoice_date_asc":
        sort_dir = 1
    elif sort == "updated_at_desc":
        sort_field, sort_dir = "updated_at", -1
    elif sort == "updated_at_asc":
        sort_field, sort_dir = "updated_at", 1

    total = await mongo_collection.count_documents(query)
    cursor = (
        mongo_collection.find(query)
        .sort(sort_field, sort_dir)
        .skip((page - 1) * page_size)
        .limit(page_size)
    )
    docs = await cursor.to_list(length=page_size)
    for d in docs:
        d["_id"] = str(d.get("_id"))
    return docs, total

# ================== MINI REPORT FALLBACK ==================
def _mini_report_fallback(payload: Dict[str, Any]) -> Dict[str, Any]:
    metrics = payload.get("metrics") or {}
    invoice = payload.get("invoice_baseline") or {}

    renew = None
    for k in ["renewableEnergy", "renewable_energy", "renewableEnergyShare", "renewable_energy_share"]:
        if k in metrics:
            renew = metrics.get(k)
            break

    baseline = (
        "Baseline compiled from available ESG snapshot and invoice baseline. "
        f"Invoice baseline keys available: {', '.join(list(invoice.keys())[:8]) or 'none'}."
    )

    benchmark = "Typical peer band (indicative): renewable share 20–35%, steady reductions in energy and water intensity over a 3–5 year horizon."
    perf = (
        "Performance vs benchmark cannot be precisely assessed without sector and revenue/production denominators, "
        "but invoice-based energy/water baselines can be used to track trend and intensity once denominators are provided."
    )

    recs = [
        "Confirm monthly baselines from invoices (energy kWh, water m³, charges) and lock the reporting boundary (sites/meters).",
        "Implement demand management and efficiency actions at peak-consumption sites (load shifting, HVAC optimisation, VSDs).",
        "Improve water efficiency through leak detection, metering, and reuse where feasible.",
        "Start a renewable pathway: on-site solar PV feasibility + green procurement options.",
    ]

    try:
        r = float(str(renew).replace("%", "").strip()) if renew is not None else None
        if r is not None and r < 20:
            perf = f"Renewable share appears below a 20% indicative peer threshold (current: {r:.1f}%)."
            recs.insert(0, "Prioritise increasing renewable share toward 20–25% through solar PV and/or wheeling where available.")
    except Exception:
        pass

    return {
        "baseline": baseline,
        "benchmark": benchmark,
        "performance_vs_benchmark": perf,
        "ai_recommendations": recs,
    }

# ================== LIFESPAN ==================
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"🚀 Starting ESG Backend on port {PORT}")
    logger.info(f"🌐 CORS Origins: {ALLOWED_ORIGINS}")
    logger.info(f"📊 OpenAPI Docs: http://localhost:{PORT}/docs")
    logger.info(f"❤️  Health Check: http://localhost:{PORT}/health")

    if not last_invoice_summaries:
        last_invoice_summaries.append(_normalize_invoice(generate_dube_tradeport_data()))
        _safe_write_json(LAST_INVOICES_JSON_PATH, last_invoice_summaries)

    yield

    logger.info("👋 Shutting down ESG Backend...")
    try:
        if mongo_client:
            mongo_client.close()
    except Exception:
        pass

# ================== FASTAPI APP ==================
app = FastAPI(title="AfricaESG.AI Backend", version="2.2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["Content-Type", "Content-Length"],
    max_age=600,
)

# ================== ROUTES ==================
@app.get("/", tags=["System"])
async def root():
    return {
        "service": "AfricaESG.AI Backend",
        "version": "2.2.0",
        "status": "operational",
        "backend_url": f"http://localhost:{PORT}",
        "cors_enabled": True,
        "credentials_allowed": True,
    }

@app.get("/health", response_model=HealthResponse, tags=["System"])
async def health():
    return HealthResponse(
        status="healthy",
        timestamp=datetime.utcnow().isoformat(),
        cors_origins=ALLOWED_ORIGINS,
        backend_port=PORT,
        frontend_urls=ALLOWED_ORIGINS,
        endpoints=[
            "/", "/health",
            "/auth/login", "/auth/me",
            "/esg/analyse", "/api/esg-data",
            "/api/environmental-insights", "/api/social-insights", "/api/governance-insights",
            "/api/invoice-upload", "/api/invoice-bulk-upload", "/api/invoice-environmental-insights",
            "/api/ai-mini-report",
            "/api/invoices", "/api/invoices/query",
            "/ws/live-ai",
        ],
    )

@app.post("/auth/login", response_model=LoginResponse, tags=["Authentication"])
async def login(credentials: LoginRequest):
    valid_users = {
        "tsakani@greenbdgafrica.com": {
            "password": "ChangeMe123!",
            "name": "Tsakani",
            "role": "admin",
            "company": "GreenBDG Africa",
        },
        "test@example.com": {
            "password": "test123",
            "name": "Test User",
            "role": "user",
            "company": "Test Company",
        },
    }

    user_data = valid_users.get(credentials.email)
    if not user_data or user_data["password"] != credentials.password:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    mock_token = "mock.jwt.token.for.dev"
    return LoginResponse(
        access_token=mock_token,
        user={
            "email": credentials.email,
            "name": user_data["name"],
            "role": user_data["role"],
            "company": user_data["company"],
        },
    )

@app.get("/auth/me", response_model=Dict[str, Any], tags=["Authentication"])
async def get_current_user():
    return {
        "email": "tsakani@greenbdgafrica.com",
        "name": "Tsakani",
        "role": "admin",
        "company": "GreenBDG Africa",
    }

@app.post("/esg/analyse", response_model=AnalyseResponse, tags=["ESG"])
async def analyse_esg(input_data: ESGInput):
    scores = calculate_esg_scores(input_data)

    insights_obj = ESGInsights(
        overall=f"Overall ESG performance for {input_data.company_name} shows promising results with opportunities in environmental efficiency.",
        environmental=[
            f"Carbon emissions of {input_data.carbon_emissions_tons} tons indicate need for a decarbonization strategy.",
            f"Energy consumption at {input_data.energy_consumption_mwh} MWh suggests efficiency opportunities.",
            f"Water usage of {input_data.water_use_m3} m³ highlights potential for conservation measures.",
        ],
        social=[
            f"Social score of {scores.s_score:.1f} reflects solid employee and community engagement.",
            "Consider expanding supplier diversity programs.",
            "Employee wellness initiatives could further boost social performance.",
        ],
        governance=[
            f"Governance score of {scores.g_score:.1f} indicates strong compliance framework.",
            "Consider enhancing board diversity and transparency reporting.",
            "Risk management processes appear robust.",
        ],
    )

    global last_esg_input
    last_esg_input = _model_dump(input_data)
    _safe_write_json(LAST_ESG_JSON_PATH, last_esg_input)

    await push_live_update()
    return AnalyseResponse(scores=scores, insights=insights_obj)

@app.get("/api/esg-data", response_model=ESGDataResponse, tags=["ESG"])
async def get_esg_data():
    mock_data = generate_esg_mock_data()
    env = mock_data.get("environmentalMetrics") or {}

    # ✅ invoices
    env["uploadedInvoiceData"] = last_invoice_summaries
    env["invoiceCount"] = len(last_invoice_summaries)

    # ✅ uploaded rows (rows, not invoices)
    env["uploadedRows"] = last_esg_uploaded_rows
    env["uploadedRowsCount"] = len(last_esg_uploaded_rows)

    mock_data["environmentalMetrics"] = env

    insights = [
        "Environmental performance baseline reflects current energy and water use, emissions, waste and fuel consumption derived from your latest ESG dataset.",
        "Comparable African industrial peers typically target steady reductions in water intensity and emissions over a 3–5 year horizon, with growing use of water recycling.",
        "Against this benchmark, your environmental profile shows clear opportunities to improve water efficiency, reduce carbon exposure and strengthen waste and fuel management.",
        "Prioritise high-impact efficiency projects at the most water-intensive sites to reduce both cost and environmental impact.",
        "Investigate key water streams for reduction, recycling or beneficiation opportunities that support circular economy outcomes.",
    ]

    return ESGDataResponse(mockData=mock_data, insights=insights, uploaded_date=now_iso())

@app.post("/api/environmental-insights", response_model=PillarInsightsResponse, tags=["Environmental"])
async def post_environmental_insights(req: EnvironmentalInsightsRequest):
    payload = {
        "company_name": req.company_name,
        "period": req.period,
        "summary": req.summary or {},
        "metrics": req.metrics or {},
        "invoice_baseline": req.invoice_baseline or {},
        "server_time": now_iso(),
    }

    def _fallback() -> List[str]:
        return [
            "Invoice-based energy and water baselines provide a stronger monthly trend signal than point-in-time ESG snapshots.",
            "Where peak demand is elevated versus average consumption, demand management and load shifting can reduce cost exposure.",
            "Water usage and water cost should be tracked together to identify efficiency gains and tariff risk.",
            "Carbon exposure can be estimated from electricity consumption using a consistent emission factor until verified site factors are available.",
            "Renewable share improvements (PV, wheeling, procurement) reduce both cost volatility and emissions intensity over time.",
        ]

    used_ai = False
    try:
        if openai_client and OPENAI_API_KEY:
            merged = dict(payload.get("metrics") or {})
            inv = payload.get("invoice_baseline") or {}
            if inv:
                merged["invoice_baseline"] = inv
            insights = generate_ai_environmental_insights(merged) or _fallback()
            used_ai = True
        else:
            insights = _fallback()
    except Exception:
        logger.exception("Falling back to static environmental insights due to AI error.")
        insights = _fallback()
        used_ai = False

    await push_live_update()
    return PillarInsightsResponse(metrics=payload, insights=insights, live=used_ai, timestamp=now_iso())

@app.post("/api/social-insights", response_model=PillarInsightsResponse, tags=["Social"])
async def post_social_insights(request: SocialInsightsRequest):
    metrics = request.metrics or {}

    def _fallback() -> List[str]:
        return [
            "Employee engagement indicators suggest stable workforce sentiment; strengthen feedback loops and manager enablement to sustain momentum.",
            "Supplier diversity signals progress, with opportunities to expand local supplier development and verification of diverse spend.",
            "Community programme activity is visible; link investment to outcomes (jobs, skills, learner support) to strengthen impact reporting.",
            "Formalise safety and wellbeing leading indicators to complement lagging incident metrics.",
            "Strengthen human rights screening and grievance channels across high-risk suppliers and sites.",
        ]

    used_ai = False
    try:
        if openai_client and OPENAI_API_KEY:
            insights = generate_ai_social_insights(metrics) or _fallback()
            used_ai = True
        else:
            insights = _fallback()
    except Exception:
        logger.exception("Falling back to static social insights due to AI error.")
        insights = _fallback()
        used_ai = False

    await push_live_update()
    return PillarInsightsResponse(metrics=metrics, insights=insights, live=used_ai, timestamp=now_iso())

@app.post("/api/governance-insights", response_model=PillarInsightsResponse, tags=["Governance"])
async def post_governance_insights(request: GovernanceInsightsRequest):
    metrics = request.metrics or {}

    def _fallback() -> List[str]:
        return [
            "Governance controls appear stable with consistent assurance cycles; strengthen evidence trails to improve auditability of ESG KPIs.",
            "Board oversight structures support accountability; align board skills and committee mandates to material ESG risks and strategy.",
            "Transparency practices can be improved through clearer KPI definitions, controls and periodic disclosure cadence.",
            "Ethics and compliance monitoring should prioritize third-party risk and supplier adherence to codes of conduct.",
            "Risk coverage can be strengthened through formal risk registers, control testing and documented remediation tracking.",
        ]

    used_ai = False
    try:
        if openai_client and OPENAI_API_KEY:
            insights = generate_ai_governance_insights(metrics) or _fallback()
            used_ai = True
        else:
            insights = _fallback()
    except Exception:
        logger.exception("Falling back to static governance insights due to AI error.")
        insights = _fallback()
        used_ai = False

    await push_live_update()
    return PillarInsightsResponse(metrics=metrics, insights=insights, live=used_ai, timestamp=now_iso())

# ✅ Optional: backward compatible GET shim
@app.get("/api/governance-insights", response_model=PillarInsightsResponse, tags=["Governance"])
async def get_governance_insights_compat():
    return PillarInsightsResponse(
        metrics={},
        insights=[
            "Governance insights endpoint is now POST.",
            '{"Call POST /api/governance-insights with JSON body: { "metrics": { ... } }"}',
        ],
        live=False,
        timestamp=now_iso(),
    )

@app.post("/api/ai-mini-report", response_model=MiniReportResponse, tags=["AI"])
async def post_ai_mini_report(req: MiniReportRequest):
    payload = {
        "company_name": req.company_name,
        "period": req.period,
        "summary": req.summary or {},
        "metrics": req.metrics or {},
        "invoice_baseline": req.invoice_baseline or {},
        "server_time": now_iso(),
    }

    used_ai = False
    try:
        if openai_client and OPENAI_API_KEY:
            report = generate_ai_mini_report(payload)
            used_ai = True
        else:
            report = _mini_report_fallback(payload)
    except Exception:
        logger.exception("Falling back to heuristic mini report due to AI error.")
        report = _mini_report_fallback(payload)
        used_ai = False

    await push_live_update()
    return MiniReportResponse(
        baseline=str(report.get("baseline", "")),
        benchmark=str(report.get("benchmark", "")),
        performance_vs_benchmark=str(report.get("performance_vs_benchmark", "")),
        ai_recommendations=list(report.get("ai_recommendations", [])),
        live=used_ai,
        timestamp=now_iso(),
    )

# ================== INVOICES ==================
@app.post("/api/invoice-upload", response_model=InvoiceUploadResponse, tags=["Invoices"])
async def upload_invoice(file: UploadFile = File(...)):
    try:
        content = await file.read()
        summary = extract_invoice_data_from_pdf(content, file.filename or "invoice.pdf")

        last_invoice_summaries.append(summary)
        _safe_write_json(LAST_INVOICES_JSON_PATH, last_invoice_summaries)

        # ✅ auto-upsert to MongoDB if configured
        if mongo_collection is not None:
            await mongo_upsert_invoice(summary)

        await push_live_update()
        return InvoiceUploadResponse(success=True, uploaded_count=1, errors=[], invoices=[summary])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@app.post("/api/invoice-bulk-upload", response_model=InvoiceUploadResponse, tags=["Invoices"])
async def bulk_upload_invoices(files: List[UploadFile] = File(...)):
    invoices: List[Dict[str, Any]] = []
    errors: List[str] = []

    for f in files:
        try:
            content = await f.read()
            summary = extract_invoice_data_from_pdf(content, f.filename or "invoice.pdf")
            invoices.append(summary)
            last_invoice_summaries.append(summary)

            if mongo_collection is not None:
                await mongo_upsert_invoice(summary)
        except Exception as e:
            errors.append(f"{f.filename}: {str(e)}")

    _safe_write_json(LAST_INVOICES_JSON_PATH, last_invoice_summaries)
    await push_live_update()

    return InvoiceUploadResponse(
        success=len(errors) == 0,
        uploaded_count=len(invoices),
        errors=errors,
        invoices=invoices,
    )

@app.get("/api/invoices", response_model=List[Dict[str, Any]], tags=["Invoices"])
async def get_invoices():
    return last_invoice_summaries

# ✅ Best endpoint for UI population (pagination + search + sort)
@app.get("/api/invoices/query", response_model=InvoiceQueryResponse, tags=["Invoices"])
async def query_invoices(
    q: Optional[str] = Query(None),
    company: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
    sort: str = Query("invoice_date_desc"),
):
    items, total = await mongo_query_invoices(
        q=q, company=company, page=page, page_size=page_size, sort=sort
    )
    return InvoiceQueryResponse(items=items, total=total, page=page, page_size=page_size)

@app.get("/api/invoice-environmental-insights", response_model=Dict[str, Any], tags=["Invoices"])
async def get_invoice_environmental_insights(last_n: int = Query(6, ge=1, le=100)):
    recent = last_invoice_summaries[-last_n:] if last_invoice_summaries else []

    total_energy = sum((inv.get("total_energy_kwh") or 0) for inv in recent)
    total_charges = sum((inv.get("total_current_charges") or 0) for inv in recent)
    total_water = sum((inv.get("water_usage") or 0) for inv in recent)
    total_water_cost = sum((inv.get("water_cost") or 0) for inv in recent)
    estimated_co2 = total_energy * 0.99 / 1000

    insights = [
        f"Total energy consumption from invoices: {total_energy:,.0f} kWh",
        f"Estimated carbon emissions: {estimated_co2:,.1f} tCO₂e",
        f"Total water usage: {total_water:,.0f} m³",
        f"Total water cost: R {total_water_cost:,.2f}",
        (f"Average tariff: R {total_charges/total_energy:.2f}/kWh" if total_energy > 0 else "No energy data"),
    ]

    if total_energy > 100000:
        insights.append("High energy consumption detected. Consider an energy efficiency audit.")
    if total_water > 10000:
        insights.append("Significant water usage. Water conservation measures recommended.")

    return {
        "metrics": {
            "total_energy_kwh": total_energy,
            "estimated_co2_tonnes": estimated_co2,
            "total_water_m3": total_water,
            "total_water_cost": total_water_cost,
            "invoice_count": len(recent),
        },
        "insights": insights,
    }

# ================== WEBSOCKET ==================
@app.websocket("/ws/live-ai")
async def websocket_live_ai(websocket: WebSocket):
    await live_ai_manager.connect(websocket)
    try:
        initial = await build_live_snapshot()
        await websocket.send_json({"type": "live-esg-update", "data": initial})

        while True:
            msg = await websocket.receive_text()
            if msg.strip().lower() in ("refresh", "ping"):
                snap = await build_live_snapshot()
                await websocket.send_json({"type": "live-esg-update", "data": snap})
    except WebSocketDisconnect:
        live_ai_manager.disconnect(websocket)
    except Exception:
        live_ai_manager.disconnect(websocket)

# ---- Added endpoints: save/load/stats (Mongo fallback to disk) ----

@app.post("/api/invoices/save-to-mongodb", response_model=Dict[str, Any], tags=["Invoices"])
async def save_invoices_to_mongodb(req: MongoDBSaveRequest):
    invoices = req.invoices or []
    if not isinstance(invoices, list) or len(invoices) == 0:
        raise HTTPException(status_code=400, detail="No invoices provided")

    inserted_count = 0
    upserted_count = 0
    errors: List[str] = []

    if mongo_collection is not None:
        for inv in invoices:
            try:
                res = await mongo_upsert_invoice(inv)
                if res:
                    inserted_count += 1
                else:
                    upserted_count += 1
            except Exception as e:
                logger.exception(f"Failed to upsert invoice: {e}")
                errors.append(str(e))

        try:
            docs = await mongo_collection.find().to_list(length=1000)
            for d in docs:
                d["_id"] = str(d.get("_id"))
            global last_invoice_summaries
            last_invoice_summaries = docs
            _safe_write_json(LAST_INVOICES_JSON_PATH, last_invoice_summaries)
        except Exception:
            logger.exception("Failed to refresh invoices after save")

        return {"success": len(errors) == 0, "insertedCount": inserted_count, "upsertedCount": upserted_count, "errors": errors}

    try:
        for inv in invoices:
            normalized = _normalize_invoice(inv)
            last_invoice_summaries.append(normalized)
            inserted_count += 1

        _safe_write_json(LAST_INVOICES_JSON_PATH, last_invoice_summaries)
        await push_live_update()
        return {"success": True, "insertedCount": inserted_count, "upsertedCount": 0, "errors": []}
    except Exception as e:
        logger.exception("Failed to save invoices to disk")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/invoices/load-from-mongodb", response_model=MongoDBLoadResponse, tags=["Invoices"])
async def load_invoices_from_mongodb():
    try:
        if mongo_collection is not None:
            docs = await mongo_collection.find().to_list(length=2000)
            for d in docs:
                d["_id"] = str(d.get("_id"))
            return MongoDBLoadResponse(success=True, invoices=docs, count=len(docs))

        return MongoDBLoadResponse(success=True, invoices=last_invoice_summaries, count=len(last_invoice_summaries))
    except Exception as e:
        logger.exception("Failed to load invoices from MongoDB")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/invoices/mongodb-stats", response_model=MongoDBStatsResponse, tags=["Invoices"])
async def invoices_mongodb_stats():
    try:
        items = []
        if mongo_collection is not None:
            items = await mongo_collection.find().to_list(length=5000)
        else:
            items = list(last_invoice_summaries)

        total_invoices = len(items)
        total_energy = 0.0
        for inv in items:
            e = inv.get("total_energy_kwh") or inv.get("sixMonthEnergyKwh") or inv.get("total_energy") or 0
            try:
                total_energy += float(e or 0)
            except Exception:
                pass

        estimated_co2 = total_energy * 0.99 / 1000

        stats = MongoDBStatsResponse(
            success=True,
            totalInvoices=total_invoices,
            totalEnergyKwh=total_energy,
            estimatedCo2=estimated_co2,
            lastUpdated=now_iso(),
            databaseName=MONGODB_DB,
        )

        return stats
    except Exception as e:
        logger.exception("Failed to compute mongodb stats")
        raise HTTPException(status_code=500, detail=str(e))

# ------------------------------------------------------------------

if __name__ == "__main__":
    logger.info(f"Backend configured on port {PORT}")
    logger.info(f"CORS origins: {ALLOWED_ORIGINS}")
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=PORT,
        reload=True,
        log_level="info",
    )
