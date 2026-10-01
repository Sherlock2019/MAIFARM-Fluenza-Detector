"""Turns stored readings into the farm picture the UI shows: houses, alerts, vaccination, biosecurity, briefing."""
from __future__ import annotations

from datetime import date

from . import engine
from .db import connect

LABELS = {
    "poultry": {"animals": "birds", "unit": "House", "cough": "Respiratory events", "activity": "Flock movement",
                "icon": "🐔", "name": "Poultry Farm", "risk": "Influenza-like risk"},
    "pig": {"animals": "pigs", "unit": "Barn", "cough": "Cough events", "activity": "Activity",
            "icon": "🐷", "name": "Pig Farm", "risk": "Health risk"},
}

ENV_NAMES = {"humidity": "humidity", "ammonia": "ammonia", "co2": "CO₂", "temp": "temperature"}
BIO_WINDOW_DAYS = 5
BIO_CATEGORIES = ["Visitor entry", "Vehicle entry", "Disinfection record", "Poultry transfers",
                  "Equipment transfers", "Door access", "Wild-bird exposure"]

SAFETY = ("AIFARM DOCTOR is an early-warning and decision-support system. It does not replace veterinary "
          "diagnosis or laboratory confirmation.")

CHECKS = {
    "respiratory": ["respiratory signs (coughing, laboured breathing, nasal discharge)", "ventilation and air quality",
                    "animal temperature (sample a few animals)", "feed quality", "water system"],
    "mortality": ["recent losses and where they occurred", "animal temperature and behaviour",
                  "water system", "feed quality", "biosecurity and recent movements"],
    "intake": ["feed quality and feeder operation", "water system (pressure, blockages, drinkers)",
               "animal behaviour at feeding", "house temperature"],
    "activity": ["animal behaviour and posture", "lameness or injuries", "temperature and stocking",
                 "feed and water access"],
    "environment": ["ventilation settings and fans", "humidity and litter / floor condition",
                    "ammonia and CO₂ sensors", "heating / cooling system"],
}

RESPONSE_PLAN = [
    "Inspect the affected poultry house",
    "Restrict unnecessary movement into and out of the house",
    "Review mortality and production data",
    "Review vaccination history",
    "Verify ventilation and environment",
    "Check recent visitors / vehicles",
    "Contact veterinarian",
    "Collect samples if veterinarian recommends",
    "Request laboratory confirmation",
    "Follow local animal-health authority procedures",
]

# Live sensor panel: (group, metric, label, mode, full scale). Engine metrics take their scale from the profile.
SIGNALS = [
    ("Camera", "activity", None, "drop", None),
    ("Camera", "clustering", "Clustering", "rise", 150),
    ("Camera", "feeder", "Feeding visits", "drop", 20),
    ("Camera", "drinker", "Drinking visits", "drop", 15),
    ("Camera", "inactive", "Inactive birds", "rise", 150),
    ("Camera", "open_beak", "Open-beak breathing", "rise", 600),
    ("Camera", "posture", "Abnormal head / neck posture", "rise", None),
    ("Camera", "balance", "Balance abnormalities", "rise", 500),
    ("Camera", "immobile", "Immobile birds", "rise", 400),
    ("Microphone", "cough", None, "rise", None),
    ("Microphone", "sneeze", "Sneezing events", "rise", 400),
    ("Microphone", "distress", "Distress calls", "rise", 80),
    ("Microphone", "vocal", "Abnormal vocalization", "rise", 300),
    ("Microphone", "acoustic", "Flock acoustic activity", "drop", 25),
    ("Water sensor", "water", "Consumption", "drop", None),
    ("Feed sensor", "feed", "Consumption", "drop", None),
    ("Environment", "temp", "Temperature", "env", None),
    ("Environment", "humidity", "Humidity", "env", None),
    ("Environment", "ammonia", "NH₃", "env", None),
    ("Environment", "co2", "CO₂", "env", None),
    ("Environment", "ventilation", "Ventilation", "vent", None),
    ("Production", "eggs", "Egg production", "drop", None),
    ("Production", "abn_eggs", "Damaged / abnormal eggs", "rise", 150),
    ("Production", "mortality", "Mortality", "rise", None),
    ("Production", "weight", "Average weight", "info", None),
]


def _fmt(v, digits=1):
    return f"{v:.{digits}f}"


def _signal_status(severity: float) -> str:
    return "NORMAL" if severity < 20 else "WATCH" if severity < 50 else "ABNORMAL" if severity < 85 else "CRITICAL"


def _sensor_panel(day: dict, profile: dict, labels: dict) -> list[dict]:
    out = []
    for group, key, label, mode, scale in SIGNALS:
        value = day["values"].get(key)
        if value is None:
            continue
        dev = day["dev"].get(key)
        scale = scale or profile["full_scale"].get(key)
        if mode == "drop":
            severity = engine.drop_score(dev, scale)
        elif mode == "rise":
            severity = engine.rise_score(dev, scale)
        elif mode == "env":
            severity = day["env"][key]
        elif mode == "vent":
            severity = engine.clamp((75 - value) / 30 * 100)
        else:
            severity = 0.0
        out.append({
            "group": group, "key": key, "mode": mode,
            "label": label or (labels["cough"] if key == "cough" else labels["activity"]),
            "value": value, "baseline": day["baseline"].get(key), "dev": dev,
            "severity": round(severity), "status": _signal_status(severity),
        })
    return out


def _pattern(day: dict, farm_type: str) -> tuple[str, str]:
    """Careful plain-language name for today's pattern + which checklist applies."""
    c = day["components"]
    if not day["warned"]:
        if c["environment"] >= 30:
            return f"High {ENV_NAMES[day['env_driver']]}", "environment"
        return "Normal", "environment"
    if c["cough"] >= 50:
        if farm_type == "poultry":
            return ("Possible influenza-like outbreak" if day["status"] == "high"
                    else "Respiratory outbreak risk"), "respiratory"
        return "Possible respiratory health risk", "respiratory"
    if c["mortality"] >= 50:
        return "Abnormal mortality pattern", "mortality"
    if c["feed"] >= 40 or c["water"] >= 40:
        return "Abnormal feed / water intake pattern", "intake"
    if c["activity"] >= 40:
        return "Abnormal activity pattern", "activity"
    return ("Abnormal flock health pattern" if farm_type == "poultry" else "Abnormal health pattern"), "respiratory"


def _contributor_label(key: str, day: dict, labels: dict, farm_type: str) -> str:
    if key == "environment":
        driver = day["env_driver"]
        return "Temperature off normal" if driver == "temp" else f"High {ENV_NAMES[driver]}"
    poultry = farm_type == "poultry"
    return {
        "cough": "Respiratory sounds" if poultry else "Cough anomaly",
        "activity": "Movement reduction" if poultry else "Reduced activity",
        "feed": "Feed reduction" if poultry else "Reduced feed intake",
        "water": "Water reduction" if poultry else "Reduced water intake",
        "mortality": "Mortality trend" if poultry else "Rising mortality",
        "eggs": "Egg production drop",
        "posture": "Abnormal posture",
        "biosecurity": "Biosecurity risk",
    }[key]


def _signal_sentence(key: str, day: dict, labels: dict) -> str:
    v, b, d = day["values"], day["baseline"], day["dev"]
    if key == "cough":
        return (f"{labels['cough']} are {abs(d['cough']):.0f}% above baseline "
                f"({_fmt(v['cough'])}/hour vs normal {_fmt(b['cough'])}).")
    if key == "activity":
        return f"{labels['activity']} dropped {abs(d['activity']):.0f}% ({_fmt(v['activity'], 0)} vs normal {_fmt(b['activity'], 0)})."
    if key == "feed":
        return f"Feed intake dropped {abs(d['feed']):.0f}% ({v['feed']:.3g} vs normal {b['feed']:.3g} kg per animal)."
    if key == "water":
        return f"Water intake dropped {abs(d['water']):.0f}% ({v['water']:.3g} vs normal {b['water']:.3g} L per animal)."
    if key == "mortality":
        return f"Daily mortality rose to {v['mortality']:.2f}% (normal {b['mortality']:.2f}%)."
    if key == "eggs":
        return f"Egg production dropped {abs(d['eggs']):.0f}% ({_fmt(v['eggs'])}% vs normal {_fmt(b['eggs'])}% lay rate)."
    if key == "posture":
        return f"Abnormal head / neck posture detections are {abs(d['posture']):.0f}% above baseline."
    if key == "biosecurity":
        return f"Biosecurity warnings were recorded in the last {BIO_WINDOW_DAYS} days (score {day['components']['biosecurity']:.0f}/100)."
    driver = day["env_driver"]
    if driver == "humidity":
        gap = v["humidity"] - b["humidity"] if b["humidity"] is not None else 0
        extra = f" — {gap:.0f} percentage points above normal" if gap >= 3 else " (comfort limit 70%)"
        return f"Humidity reached {v['humidity']:.0f}%{extra}."
    if driver == "ammonia":
        return f"Ammonia reached {v['ammonia']:.0f} ppm (comfort limit 20 ppm)."
    if driver == "co2":
        return f"CO₂ reached {v['co2']:.0f} ppm (comfort limit 2,500 ppm)."
    return f"Temperature is {abs(v['temp'] - b['temp']):.1f}°C away from its normal {_fmt(b['temp'])}°C."


def _ventilation_status(score) -> str:
    if score is None:
        return "No data"
    return "Normal" if score >= 75 else "Reduced" if score >= 60 else "Poor"


def _barn_summary(barn: str, days: list[dict], meta: dict, labels: dict, farm_type: str, profile: dict) -> dict:
    today = days[-1]
    poultry = farm_type == "poultry"
    contribs = engine.contributors(today, profile)
    for c in contribs:
        c["label"] = _contributor_label(c["key"], today, labels, farm_type)
    signals = [_signal_sentence(c["key"], today, labels) for c in contribs if today["components"][c["key"]] >= 15]
    pattern, check_key = _pattern(today, farm_type)
    before = days[-3]["risk"] if len(days) >= 3 else days[0]["risk"]
    delta = today["risk"] - before
    unit = labels["unit"]
    det = engine.detection(days)

    timing = context = ""
    recommended, checks = [], []
    if today["warned"]:
        summary = (f"{unit} {barn} has shown multiple simultaneous changes." if len(signals) >= 2
                   else f"{unit} {barn} shows an abnormal pattern.")
        if len(signals) >= 2:
            hours = max(24, (len(days) - 1 - det["ai_index"]) * 24)
            timing = f"These indicators have appeared together within the last {hours} hours."
        context = (f"The combined pattern is unusual compared with the previous {engine.BASELINE_WINDOW}-day "
                   f"baseline. The risk score moved from {before} to {today['risk']} over the last 48 hours.")
        recommended = [f"Inspect {unit} {barn}."]
        if poultry:
            recommended += ["Review biosecurity.", "Review vaccination records."]
        if today["status"] == "high":
            recommended.append("Contact your veterinarian." if poultry
                               else "Consider veterinary assessment if abnormalities are confirmed.")
        checks = CHECKS[check_key]
        disclaimer = ("This does not confirm avian influenza. Veterinary inspection and laboratory testing are "
                      "required for diagnosis." if poultry else
                      "This is an abnormal pattern, not a diagnosis. Veterinary review is recommended.")
    elif signals:
        summary = f"{unit} {barn} is within its normal health range, with one point to keep an eye on."
        recommended = ["No urgent action. Check this during the next routine round."]
        disclaimer = ""
    else:
        summary = f"{unit} {barn} is within its normal range on all monitored signals."
        recommended = ["No action needed. Continue routine monitoring."]
        disclaimer = ""

    recent = days[-14:]
    return {
        "barn": barn,
        "breed": meta.get("breed") or "Not recorded",
        "avg_age_days": meta.get("avg_age_days"),
        "biosecurity": meta.get("biosecurity") or "Not recorded",
        "last_movement": meta.get("last_movement") or "Not recorded",
        "medication": meta.get("medication") or "Not recorded",
        "animal_count": today["animal_count"],
        "date": today["date"],
        "risk": today["risk"],
        "level": today["level"],
        "status": today["status"],
        "warned": today["warned"],
        "pattern": pattern,
        "risk_delta_48h": delta,
        "values": today["values"],
        "baseline": today["baseline"],
        "dev": today["dev"],
        "components": today["components"],
        "env": today["env"],
        "env_driver": today["env_driver"],
        "ventilation_status": _ventilation_status(today["values"]["ventilation"]),
        "contributors": contribs,
        "signals": signals,
        "panel": _sensor_panel(today, profile, labels),
        "explanation": {
            "summary": summary, "signals": signals, "timing": timing, "context": context,
            "disclaimer": disclaimer, "recommended": recommended, "checks": checks,
        },
        "response_plan": RESPONSE_PLAN if poultry and today["status"] == "high" else [],
        "detection": det,
        "resp_alerts_14d": sum(1 for d in recent if d["components"]["cough"] >= 50),
        "spark": [d["risk"] for d in recent],
        "days": days,
    }


# ---------------------------------------------------------------- biosecurity

def _bio_score(events: list[dict], barn: str, day: str) -> float:
    d = date.fromisoformat(day)
    points = sum(
        e["points"] or 0 for e in events
        if e["status"] == "warning" and e["barn"] in (None, barn)
        and 0 <= (d - date.fromisoformat(e["date"])).days < BIO_WINDOW_DAYS
    )
    return min(100.0, points)


def _user_bio_events(readings: list[dict]) -> list[dict]:
    """For user data, a biosecurity incident typed into a reading becomes a warning event."""
    return [
        {"date": r["date"], "time": None, "barn": r["barn"], "category": "Reported incident",
         "title": r["biosecurity_incident"].strip(), "detail": "Entered with the daily farm data.",
         "action": "Verify the incident and confirm disinfection before house access.", "status": "warning",
         "points": 60}
        for r in readings if (r.get("biosecurity_incident") or "").strip()
    ]


def _biosecurity(events: list[dict], barns: list[dict], as_of: str | None, weight: float) -> dict:
    today = date.fromisoformat(as_of) if as_of else date.today()
    events = sorted(events, key=lambda e: (e["date"], e["time"] or ""), reverse=True)
    for e in events:
        age = (today - date.fromisoformat(e["date"])).days
        e["active"] = e["status"] == "warning" and 0 <= age < BIO_WINDOW_DAYS
        e["contribution"] = round(weight * (e["points"] or 0), 1) if e["active"] else 0
    categories = []
    for name in BIO_CATEGORIES + sorted({e["category"] for e in events} - set(BIO_CATEGORIES)):
        mine = [e for e in events if e["category"] == name]
        if name not in BIO_CATEGORIES and not mine:
            continue
        categories.append({"name": name, "records": len(mine), "warnings": sum(1 for e in mine if e["active"])})
    return {
        "events": events,
        "warnings": [e for e in events if e["active"]],
        "categories": categories,
        "scores": {b["barn"]: round(b["components"]["biosecurity"]) for b in barns},
        "window_days": BIO_WINDOW_DAYS,
        "weight": weight,
    }


# ---------------------------------------------------------------- vaccination

def _vacc_status(row: dict) -> str:
    if row["overdue"] > 0:
        return "Overdue"
    if row["missing"] > 0:
        return "Missing"
    if row["due"] > 0:
        return "Due"
    return "OK"


def _user_vaccinations(latest_rows: dict[str, dict]) -> list[dict]:
    """For user data, vaccination state comes from the latest reading of each house."""
    out = []
    for barn, row in latest_rows.items():
        count = int(row["animal_count"] or 0)
        text = (row["vaccination_status"] or "").strip().lower()
        bucket = ("overdue" if "over" in text else "due" if "due" in text else
                  "vaccinated" if text and "miss" not in text and text not in ("no", "none", "unknown") else "missing")
        out.append({"barn": barn, "animals": count, "vaccine": "As recorded", "last_dose": None, "next_dose": None,
                    "vaccinated": 0, "due": 0, "overdue": 0, "missing": 0, **{bucket: count}})
    return out


def _vaccination(rows: list[dict], barns: dict[str, dict]) -> dict:
    for r in rows:
        r["status"] = _vacc_status(r)
        r["completion"] = round(r["vaccinated"] / r["animals"] * 100) if r["animals"] else 0
    total = sum(r["animals"] for r in rows)
    summary = {
        "total": total,
        "vaccinated": sum(r["vaccinated"] for r in rows),
        "due": sum(r["due"] for r in rows),
        "overdue": sum(r["overdue"] for r in rows),
        "missing": sum(r["missing"] for r in rows),
    }
    summary["compliance"] = round(summary["vaccinated"] / total * 100) if total else 0

    insight = None
    gaps = [r for r in rows if r["overdue"] + r["missing"] > 0 and r["barn"] in barns]
    if gaps:
        r = min(gaps, key=lambda x: x["completion"])
        b = barns[r["barn"]]
        insight = {
            "barn": r["barn"],
            "completion": r["completion"],
            "risk": b["risk"],
            "resp_alerts": b["resp_alerts_14d"],
            "mortality_trend": round(b["dev"]["mortality"] or 0, 2),
            "recommendation": ("Review missing vaccination records and request veterinary review before changing "
                               "the vaccination program."),
        }
    return {"summary": summary, "rows": rows, "insight": insight}


# ---------------------------------------------------------------- alerts, timeline, briefing

def _alerts(barns: list[dict], vacc: dict, bio: dict, labels: dict) -> list[dict]:
    out = []
    for b in barns:
        if b["warned"]:
            out.append({
                "type": "health", "barn": b["barn"], "risk": b["risk"], "level": b["level"],
                "severity": "high" if b["status"] == "high" else "watch",
                "title": f"{b['pattern']} detected",
                "message": " ".join(b["signals"][:3]),
            })
        elif b["components"]["environment"] >= 30:
            out.append({
                "type": "environment", "barn": b["barn"], "risk": b["risk"], "severity": "watch",
                "title": b["pattern"],
                "message": _signal_sentence("environment", b, labels),
            })
    for e in bio["warnings"]:
        out.append({"type": "biosecurity", "barn": e["barn"] or "Farm", "risk": None, "severity": "watch",
                    "title": e["title"], "message": f"{e['detail']} {e['action']}".strip()})
    for r in vacc["rows"]:
        if r["overdue"] > 0:
            out.append({"type": "vaccination", "barn": r["barn"], "risk": None, "severity": "watch",
                        "title": "Vaccination overdue",
                        "message": f"{r['overdue']:,} {labels['animals']} overdue for {r['vaccine']}"
                                   + (f", {r['missing']:,} with missing records." if r["missing"] else ".")})
        elif r["due"] > 0:
            out.append({"type": "vaccination", "barn": r["barn"], "risk": None, "severity": "info",
                        "title": "Vaccination due this week",
                        "message": f"{r['due']:,} {labels['animals']} due for {r['vaccine']}."})
    order = {"high": 0, "watch": 1, "info": 2}
    return sorted(out, key=lambda a: (order[a["severity"]], -(a["risk"] or 0)))


def _timeline(barns: list[dict], labels: dict) -> list[dict]:
    """Risk level changes over the last 14 days, newest first."""
    rank = {"LOW": 0, "WATCH": 1, "HIGH": 2, "CRITICAL": 3}
    events = []
    for b in barns:
        days = b["days"][-15:]
        for prev, cur in zip(days, days[1:]):
            if rank[cur["level"]] != rank[prev["level"]]:
                rising = rank[cur["level"]] > rank[prev["level"]]
                events.append({
                    "date": cur["date"], "barn": b["barn"], "rising": rising, "level": cur["level"],
                    "text": f"{labels['risk']} {'rose' if rising else 'eased'} from {prev['level']} to "
                            f"{cur['level']} ({cur['risk']}/100).",
                })
            if cur["components"]["environment"] >= 30 > prev["components"]["environment"]:
                events.append({"date": cur["date"], "barn": b["barn"], "rising": True, "level": "ENV",
                               "text": _signal_sentence("environment", cur, labels)})
    return sorted(events, key=lambda e: (e["date"], e["barn"]), reverse=True)


def _join(names: list[str]) -> str:
    return names[0] if len(names) == 1 else ", ".join(names[:-1]) + " and " + names[-1]


def _briefing(barns: list[dict], vacc: dict, bio: dict, health: int, labels: dict) -> dict:
    unit = labels["unit"]
    priorities = []
    risky = sorted([b for b in barns if b["warned"]], key=lambda b: -b["risk"])
    for b in risky:
        title = f"Inspect {unit} {b['barn']}." if b["status"] == "high" else f"Keep a close watch on {unit} {b['barn']}."
        change = (f"up {b['risk_delta_48h']} points over the last 48 hours"
                  if b["risk_delta_48h"] > 0 else "still elevated")
        priorities.append({"title": title, "barn": b["barn"], "page": "risk",
                           "reason": f"{b['pattern']} — risk score {b['risk']}/100 ({b['level']}), {change}."})
    if bio["warnings"]:
        houses = sorted({e["barn"] or "the farm" for e in bio["warnings"]})
        priorities.append({"title": f"Verify biosecurity warnings for {_join(houses)}.", "barn": houses[0],
                           "page": "biosecurity",
                           "reason": f"{len(bio['warnings'])} open: " + "; ".join(e["title"] for e in bio["warnings"][:2]) + "."})
    for r in vacc["rows"]:
        if r["overdue"] + r["missing"] > 0:
            parts = [f"{r['overdue']:,} overdue"] if r["overdue"] else []
            parts += [f"{r['missing']:,} missing records"] if r["missing"] else []
            priorities.append({"title": f"Review vaccination records for {r['barn']}.", "barn": r["barn"],
                               "page": "vaccination", "reason": " and ".join(parts).capitalize() + "."})
    humid = [b["barn"] for b in barns if b["env"]["humidity"] >= 25]
    if humid:
        priorities.append({"title": f"Humidity remains high in {_join(humid)}.", "barn": humid[0], "page": "health",
                           "reason": "Check ventilation during the next round."})
    others = [b for b in barns if not b["warned"]]
    unusual = [b["barn"] for b in others if b["components"]["mortality"] >= 30]
    if not barns:
        note = ""
    elif unusual:
        note = f"Mortality is above normal in {_join(unusual)}."
    elif risky:
        note = f"No unusual mortality detected in other {unit.lower()}s."
    else:
        note = f"No unusual patterns detected. All {unit.lower()}s are within their normal range."
    return {"health_score": health, "priorities": priorities, "note": note}


# ---------------------------------------------------------------- entry point

def analyze(source: str, farm_type: str) -> dict:
    labels = LABELS[farm_type]
    profile = engine.PROFILES[farm_type]
    with connect() as conn:
        args = (source, farm_type)
        readings = [dict(r) for r in conn.execute(
            "SELECT * FROM readings WHERE source = ? AND farm_type = ? ORDER BY barn, date", args)]
        metas = {r["barn"]: dict(r) for r in conn.execute(
            "SELECT * FROM barns WHERE source = ? AND farm_type = ?", args)}
        vacc_rows = [dict(r) for r in conn.execute(
            "SELECT barn, animals, vaccine, last_dose, next_dose, vaccinated, due, overdue, missing "
            "FROM vaccinations WHERE source = ? AND farm_type = ? ORDER BY barn", args)]
        bio_events = [dict(r) for r in conn.execute(
            "SELECT date, time, barn, category, title, detail, action, status, points "
            "FROM biosecurity_events WHERE source = ? AND farm_type = ?", args)]

    by_barn: dict[str, list[dict]] = {}
    for r in readings:
        by_barn.setdefault(r["barn"], []).append(r)
    if source == "user":
        bio_events = _user_bio_events(readings)
        vacc_rows = _user_vaccinations({name: rows[-1] for name, rows in by_barn.items()})

    barns = []
    for name, rows in by_barn.items():
        scores = [_bio_score(bio_events, name, r["date"]) for r in rows]
        days = engine.analyze_barn(rows, profile, scores)
        barns.append(_barn_summary(name, days, metas.get(name, {}), labels, farm_type, profile))
    barn_map = {b["barn"]: b for b in barns}

    vacc = _vaccination(vacc_rows, barn_map)
    for b in barns:
        b["vaccination"] = next((r for r in vacc["rows"] if r["barn"] == b["barn"]), None)

    as_of = max((b["date"] for b in barns), default=None)
    bio = _biosecurity(bio_events, barns, as_of, profile["weights"].get("biosecurity", 0))
    health = round(100 - sum(b["risk"] for b in barns) / len(barns)) if barns else None
    top = max(barns, key=lambda b: b["risk"]) if barns else None
    farm_name = (max(readings, key=lambda r: r["date"])["farm"] or "My Farm") if readings else "My Farm"
    return {
        "source": source,
        "farm_type": farm_type,
        "farm": farm_name,
        "labels": labels,
        "has_data": bool(barns),
        "as_of": as_of,
        "reading_count": len(readings),
        "health_score": health,
        "counts": {s: sum(1 for b in barns if b["status"] == s) for s in ("healthy", "watch", "high")},
        "total_animals": sum(b["animal_count"] or 0 for b in barns),
        "barns": barns,
        "top_barn": top["barn"] if top else None,
        "story_barn": top["barn"] if source == "demo" and top else None,
        "vaccination": vacc,
        "biosecurity": bio,
        "alerts": _alerts(barns, vacc, bio, labels),
        "timeline": _timeline(barns, labels),
        "briefing": _briefing(barns, vacc, bio, health, labels),
        "safety": SAFETY,
        "engine": {"name": profile["name"], "weights": profile["weights"], "full_scale": profile["full_scale"],
                   "levels": profile["levels"], "classic_rules": profile["classic"],
                   "env_limits": engine.ENV_LIMITS, "baseline_window": engine.BASELINE_WINDOW},
    }
