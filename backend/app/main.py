"""AIFARM DOCTOR API."""
import io
import json
import re
from contextlib import asynccontextmanager
from pathlib import Path
from datetime import date
from typing import Literal, Optional

import pandas as pd
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import assistant, service
from .db import connect, init_db, upsert_readings
from .seed import seed_demo

Source = Literal["demo", "user"]
FarmType = Literal["pig", "poultry"]


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    seed_demo()
    yield


app = FastAPI(title="AIFARM DOCTOR", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


# ---------------------------------------------------------------- farm views

def _light(barn: dict) -> dict:
    return {k: v for k, v in barn.items() if k != "days"}


@app.get("/api/farm")
def farm(source: Source = "demo", farm_type: FarmType = "poultry"):
    data = service.analyze(source, farm_type)
    data["suggestions"] = assistant.suggestions(data)
    data["barns"] = [_light(b) for b in data["barns"]]
    return data


@app.get("/api/barns/{barn}")
def barn_detail(barn: str, source: Source = "demo", farm_type: FarmType = "poultry"):
    data = service.analyze(source, farm_type)
    found = next((b for b in data["barns"] if b["barn"] == barn), None)
    if not found:
        raise HTTPException(404, f"Unknown barn {barn}")
    return found


class Question(BaseModel):
    question: str
    source: Source = "demo"
    farm_type: FarmType = "poultry"


@app.post("/api/chat")
def chat(q: Question):
    return assistant.answer(q.question, service.analyze(q.source, q.farm_type))


# ---------------------------------------------------------------- manual entry

class Reading(BaseModel):
    farm_type: FarmType = "poultry"
    farm: str = "My Farm"
    barn: str = Field(min_length=1)
    date: date
    animal_count: float = Field(gt=0)
    feed_kg: Optional[float] = Field(None, ge=0)
    water_l: Optional[float] = Field(None, ge=0)
    avg_weight: Optional[float] = Field(None, ge=0)
    mortality: Optional[float] = Field(None, ge=0)
    activity: Optional[float] = Field(None, ge=0, le=100)
    cough_events: Optional[float] = Field(None, ge=0)
    temp: Optional[float] = None
    humidity: Optional[float] = Field(None, ge=0, le=100)
    ammonia: Optional[float] = Field(None, ge=0)
    co2: Optional[float] = Field(None, ge=0)
    egg_production: Optional[float] = Field(None, ge=0)
    feeder_visits: Optional[float] = Field(None, ge=0)
    drinker_visits: Optional[float] = Field(None, ge=0)
    distress_events: Optional[float] = Field(None, ge=0)
    vaccination_status: Optional[str] = None
    biosecurity_incident: Optional[str] = None
    notes: Optional[str] = None


@app.post("/api/readings")
def add_reading(r: Reading):
    row = r.model_dump()
    row.update(source="user", barn=r.barn.strip(), date=r.date.isoformat())
    with connect() as conn:
        upsert_readings(conn, [row])
    return {"saved": 1}


@app.delete("/api/user-data")
def clear_user_data(farm_type: FarmType = "poultry"):
    with connect() as conn:
        n = conn.execute("DELETE FROM readings WHERE source = 'user' AND farm_type = ?", (farm_type,)).rowcount
    return {"deleted": n}


# ---------------------------------------------------------------- CSV import

# key, label, required, aliases
FIELDS = [
    ("date", "Date", True, ["day", "recorddate", "readingdate"]),
    ("barn", "House / barn", True, ["house", "houseid", "barnid", "barnname", "pen", "shed", "flock"]),
    ("animal_count", "Bird / animal count", True, ["animals", "count", "headcount", "birds", "birdcount", "pigs",
                                                   "numberofanimals"]),
    ("feed_kg", "Feed consumption (kg, whole house)", False, ["feed", "feedintake", "feedtotal", "feedconsumption"]),
    ("water_l", "Water consumption (L, whole house)", False, ["water", "waterintake", "waterused", "waterconsumption"]),
    ("activity", "Movement / activity score (0-100)", False, ["activityscore", "movement", "movementscore",
                                                              "movementindex"]),
    ("cough_events", "Respiratory / cough events per hour", False, ["cough", "coughs", "respiratoryevents",
                                                                    "respiratory"]),
    ("egg_production", "Eggs produced that day", False, ["eggs", "eggcount"]),
    ("mortality", "Mortality (deaths that day)", False, ["deaths", "dead", "losses"]),
    ("temp", "Temperature (°C)", False, ["temperature", "barntemp", "housetemp", "tempc"]),
    ("humidity", "Humidity (%)", False, ["rh", "relativehumidity"]),
    ("co2", "CO₂ (ppm)", False, ["co2ppm"]),
    ("ammonia", "Ammonia / NH₃ (ppm)", False, ["nh3", "nh3ppm"]),
    ("feeder_visits", "Feeder visits", False, ["feedervisit", "feedingvisits"]),
    ("drinker_visits", "Drinker visits", False, ["drinkervisit", "drinkingvisits"]),
    ("distress_events", "Distress events per hour", False, ["distress", "distresscalls"]),
    ("avg_weight", "Average weight (kg)", False, ["weight", "averageweight"]),
    ("ventilation", "Ventilation score (0-100)", False, ["ventilationscore"]),
    ("vaccination_status", "Vaccination status", False, ["vaccination", "vaccine", "vaccinestatus"]),
    ("biosecurity_incident", "Biosecurity incident", False, ["biosecurity", "incident"]),
    ("notes", "Notes", False, ["note", "comment", "comments"]),
]
TEXT_FIELDS = {"date", "barn", "vaccination_status", "biosecurity_incident", "notes"}

EXAMPLE_POULTRY_CSV = """date,house,birds,feed_kg,water_l,movement,respiratory_events,egg_production,mortality,temp,humidity,co2,nh3
2026-09-01,C-01,10000,1250,2100,91,7,9200,5,25.0,67,1800,12
2026-09-02,C-01,10000,1245,2090,90,8,9180,5,25.2,69,1850,13
2026-09-03,C-01,10000,1252,2105,91,7,9210,4,25.1,68,1820,12
2026-09-04,C-01,10000,1248,2095,91,7,9195,5,25.0,67,1810,12
2026-09-05,C-01,10000,1251,2102,90,8,9205,5,25.1,68,1830,13
2026-09-06,C-01,10000,1246,2088,91,10,9190,5,25.3,78,1900,14
2026-09-07,C-01,10000,1215,2060,83,19,9110,6,25.4,81,2050,16
2026-09-08,C-01,10000,1125,1950,76,31,8830,8,25.6,83,2200,19
2026-09-09,C-01,10000,1025,1910,68,52,8370,11,25.7,84,2400,21
2026-09-01,C-02,10000,1240,2080,90,6,9150,5,24.8,65,1750,11
2026-09-02,C-02,10000,1238,2075,91,6,9160,4,24.9,66,1760,11
2026-09-03,C-02,10000,1243,2084,90,7,9155,5,24.8,65,1740,12
2026-09-04,C-02,10000,1239,2078,91,6,9148,5,24.9,66,1755,11
2026-09-05,C-02,10000,1241,2081,90,6,9152,5,24.8,65,1750,11
2026-09-06,C-02,10000,1237,2076,91,6,9158,4,24.9,66,1745,11
2026-09-07,C-02,10000,1242,2082,90,7,9150,5,24.8,65,1760,12
2026-09-08,C-02,10000,1240,2079,91,6,9154,5,24.9,66,1750,11
2026-09-09,C-02,10000,1239,2080,90,6,9151,5,24.8,65,1755,11
"""

EXAMPLE_PIG_CSV = """date,barn,animal_count,feed_kg,water_l,activity,cough_events,mortality,temp,humidity,ammonia
2026-09-01,P-01,800,2020,5200,92,4,1,24.5,68,12
2026-09-02,P-01,800,2015,5180,91,5,1,24.7,69,13
2026-09-03,P-01,800,2030,5215,92,4,0,24.4,68,12
2026-09-04,P-01,800,2018,5190,91,4,1,24.6,70,13
2026-09-05,P-01,800,2022,5205,92,5,1,24.5,69,12
2026-09-06,P-01,800,2010,5170,90,6,1,24.9,74,14
2026-09-07,P-01,800,1975,5080,87,9,1,25.1,79,16
2026-09-08,P-01,800,1890,4900,82,12,2,25.3,83,19
2026-09-01,P-02,750,1900,4880,90,5,1,24.2,66,11
2026-09-02,P-02,750,1895,4870,91,5,0,24.3,67,11
2026-09-03,P-02,750,1905,4890,90,4,1,24.1,66,12
2026-09-04,P-02,750,1898,4875,91,5,1,24.2,67,11
2026-09-05,P-02,750,1902,4885,90,5,1,24.3,66,11
2026-09-06,P-02,750,1896,4872,91,4,0,24.2,67,12
2026-09-07,P-02,750,1901,4880,90,5,1,24.1,66,11
2026-09-08,P-02,750,1899,4878,91,5,1,24.2,67,11
"""


def _norm(name: str) -> str:
    return re.sub(r"[^a-z0-9]", "", str(name).lower())


def _read_csv(raw: bytes) -> pd.DataFrame:
    try:
        df = pd.read_csv(io.BytesIO(raw), dtype=str, sep=None, engine="python", encoding="utf-8-sig")
    except Exception as exc:
        raise HTTPException(400, f"Could not read this file as CSV: {exc}")
    df.columns = [str(c).strip() for c in df.columns]
    df = df.dropna(how="all")
    if df.empty or not len(df.columns):
        raise HTTPException(400, "The file contains no data rows.")
    return df


def _suggest_mapping(columns: list[str]) -> dict:
    mapping, used = {}, set()
    for key, _, _, aliases in FIELDS:
        names = {_norm(key), *aliases}
        match = next((c for c in columns if c not in used and _norm(c) in names), None)
        mapping[key] = match
        if match:
            used.add(match)
    return mapping


@app.get("/api/import/example.csv", response_class=PlainTextResponse)
def example_csv(farm_type: FarmType = "poultry"):
    text = EXAMPLE_POULTRY_CSV if farm_type == "poultry" else EXAMPLE_PIG_CSV
    return PlainTextResponse(text, media_type="text/csv",
                             headers={"Content-Disposition": "attachment; filename=aifarm_example.csv"})


@app.post("/api/import/preview")
async def import_preview(file: UploadFile = File(...)):
    df = _read_csv(await file.read())
    columns = list(df.columns)
    mapping = _suggest_mapping(columns)
    mapped = {c for c in mapping.values() if c}
    unmatched = [c for c in columns if c not in mapped]
    missing_required = [label for key, label, required, _ in FIELDS if required and not mapping[key]]
    return {
        "filename": file.filename,
        "rows": len(df),
        "columns": columns,
        "fields": [{"key": k, "label": label, "required": req} for k, label, req, _ in FIELDS],
        "mapping": mapping,
        "unmatched_columns": unmatched,
        "missing_required": missing_required,
        "needs_mapping": bool(unmatched or missing_required
                              or any(c and _norm(c) != _norm(k) for k, c in mapping.items())),
        "sample": df.head(5).fillna("").to_dict(orient="records"),
    }


@app.post("/api/import/commit")
async def import_commit(file: UploadFile = File(...), mapping: str = Form(...),
                        farm_type: FarmType = Form("poultry"), farm: str = Form("My Farm")):
    df = _read_csv(await file.read())
    try:
        chosen = {k: v for k, v in json.loads(mapping).items() if v}
    except json.JSONDecodeError:
        raise HTTPException(400, "Invalid column mapping.")
    known = {k for k, *_ in FIELDS}
    for key, column in chosen.items():
        if key not in known or column not in df.columns:
            raise HTTPException(400, f"Invalid mapping: {column} → {key}")
    missing = [label for key, label, required, _ in FIELDS if required and key not in chosen]
    if missing:
        raise HTTPException(400, "Please map these required fields: " + ", ".join(missing))

    data = pd.DataFrame({key: df[column] for key, column in chosen.items()})
    data["date"] = pd.to_datetime(data["date"], errors="coerce")
    for key in data.columns:
        if key not in TEXT_FIELDS:
            data[key] = pd.to_numeric(data[key].str.replace(",", "", regex=False), errors="coerce")

    rows, errors = [], []
    for i, rec in enumerate(data.to_dict(orient="records")):
        line = i + 2  # header is line 1
        barn = "" if pd.isna(rec["barn"]) else str(rec["barn"]).strip()
        problem = None
        if pd.isna(rec["date"]):
            problem = "date is missing or not recognised"
        elif not barn:
            problem = "barn is empty"
        elif pd.isna(rec["animal_count"]) or rec["animal_count"] <= 0:
            problem = "animal count must be a number above 0"
        else:
            negative = [k for k, v in rec.items() if k not in TEXT_FIELDS and k != "temp" and pd.notna(v) and v < 0]
            if negative:
                problem = f"negative value in {', '.join(negative)}"
        if problem:
            errors.append({"line": line, "problem": problem})
            continue
        row = {k: (None if pd.isna(v) else v) for k, v in rec.items()}
        row.update(source="user", farm_type=farm_type, farm=farm.strip() or "My Farm", barn=barn,
                   date=rec["date"].date().isoformat())
        rows.append(row)

    if rows:
        with connect() as conn:
            upsert_readings(conn, rows)
    return {
        "imported": len(rows),
        "skipped": len(errors),
        "errors": errors[:20],
        "barns": sorted({r["barn"] for r in rows}),
    }


# ---------------------------------------------------------------- built frontend (server mode)

# `./start.sh --prod` builds the frontend; when that build exists it is served from this same port.
_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if _DIST.is_dir():
    app.mount("/", StaticFiles(directory=_DIST, html=True), name="web")
