"""Transparent risk engine (shared by poultry and pig farms).

For every house and every day:
  1. baseline  = rolling median of the previous 21 days
  2. deviation = % difference between today's value and the baseline
  3. anomaly   = deviation mapped to a 0-100 scale (only the harmful direction counts)
  4. risk      = weighted sum of the anomaly scores

Only the weights, scales and level thresholds differ per farm type (see PROFILES).
"""
from __future__ import annotations

from statistics import median

BASELINE_WINDOW = 21

PROFILES = {
    # Influenza-like risk for poultry flocks.
    "poultry": {
        "name": "Influenza-like risk",
        "weights": {
            "cough": 0.25,        # respiratory audio
            "activity": 0.15,     # flock movement drop
            "feed": 0.10,
            "water": 0.10,
            "mortality": 0.15,
            "eggs": 0.10,
            "posture": 0.05,      # abnormal head / neck posture (camera)
            "environment": 0.05,
            "biosecurity": 0.05,
        },
        # Deviation at which an anomaly score reaches 100.
        "full_scale": {"cough": 200.0, "activity": 20.0, "feed": 15.0, "water": 12.0, "mortality": 0.3,
                       "eggs": 10.0, "posture": 300.0},
        "levels": {"WATCH": 30, "HIGH": 50, "CRITICAL": 75},
        # What a farm would typically notice on manual rounds.
        "classic": {"feed": 15.0, "activity": 20.0, "mortality": 0.05, "eggs": 8.0},
    },
    # General health risk for pig barns.
    "pig": {
        "name": "Health risk",
        "weights": {"cough": 0.25, "activity": 0.20, "feed": 0.20, "water": 0.10, "mortality": 0.15,
                    "environment": 0.10},
        "full_scale": {"cough": 100.0, "activity": 15.0, "feed": 14.0, "water": 10.0, "mortality": 0.6,
                       "eggs": 10.0, "posture": 300.0},
        "levels": {"WATCH": 40, "HIGH": 70, "CRITICAL": 85},
        "classic": {"feed": 10.0, "activity": 15.0, "mortality": 0.2},
    },
}

# Environment comfort limits: (start of concern, score reaches 100)
ENV_LIMITS = {
    "humidity": (70.0, 85.0),     # %
    "ammonia": (20.0, 35.0),      # ppm
    "co2": (2500.0, 4000.0),      # ppm
    "temp": (3.0, 8.0),           # degrees C away from the house's normal temperature
}

# metric -> reading column (plain values)
COLUMNS = {
    "activity": "activity", "cough": "cough_events", "humidity": "humidity", "temp": "temp",
    "ammonia": "ammonia", "co2": "co2", "ventilation": "ventilation", "weight": "avg_weight",
    "feeder": "feeder_visits", "drinker": "drinker_visits", "inactive": "inactive_pct", "active": "active_pct",
    "clustering": "clustering", "open_beak": "open_beak", "posture": "posture_events",
    "balance": "balance_events", "immobile": "immobile_birds", "distress": "distress_events",
    "sneeze": "sneeze_events", "vocal": "vocal_events", "acoustic": "acoustic",
}
METRICS = ["feed", "water", "mortality", "eggs", "abn_eggs", *COLUMNS]


def level_for(risk: float, profile: dict) -> str:
    lv = profile["levels"]
    return "CRITICAL" if risk >= lv["CRITICAL"] else "HIGH" if risk >= lv["HIGH"] else "WATCH" if risk >= lv["WATCH"] else "LOW"


def status_for(level: str) -> str:
    return {"LOW": "healthy", "WATCH": "watch"}.get(level, "high")


def _num(v):
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return None if f != f else f


def clamp(x: float) -> float:
    return max(0.0, min(100.0, x))


def _derive(row: dict) -> dict:
    count = _num(row.get("animal_count")) or 0

    def per_animal(key, factor=1.0):
        v = _num(row.get(key))
        return v / count * factor if v is not None and count > 0 else None

    eggs, abnormal = _num(row.get("egg_production")), _num(row.get("abnormal_eggs"))
    out = {
        "feed": per_animal("feed_kg"),
        "water": per_animal("water_l"),
        "mortality": per_animal("mortality", 100.0),          # % of animals per day
        "eggs": per_animal("egg_production", 100.0),           # lay rate %
        "abn_eggs": abnormal / eggs * 100 if abnormal is not None and eggs else None,
    }
    out.update({metric: _num(row.get(column)) for metric, column in COLUMNS.items()})
    return out


def drop_score(dev, scale):
    return clamp(-dev / scale * 100) if dev is not None else 0.0


def rise_score(dev, scale):
    return clamp(dev / scale * 100) if dev is not None else 0.0


def range_score(value, limits):
    if value is None:
        return 0.0
    start, full = limits
    return clamp((value - start) / (full - start) * 100)


def analyze_barn(rows: list[dict], profile: dict, bio_scores: list[float] | None = None) -> list[dict]:
    """rows: one house's readings sorted by date. Returns one analysed dict per day."""
    values = [_derive(r) for r in rows]
    scale, weights = profile["full_scale"], profile["weights"]
    watch = profile["levels"]["WATCH"]
    days = []
    for i, row in enumerate(rows):
        v = values[i]
        window = values[max(0, i - BASELINE_WINDOW):i]
        base, dev = {}, {}
        for k in METRICS:
            history = [w[k] for w in window if w[k] is not None]
            base[k] = median(history) if history else v[k]
            if v[k] is None or base[k] is None:
                dev[k] = None
            elif k == "mortality":
                dev[k] = v[k] - base[k]            # percentage points
            elif base[k] == 0:
                dev[k] = None
            else:
                dev[k] = (v[k] - base[k]) / base[k] * 100

        temp_gap = abs(v["temp"] - base["temp"]) if v["temp"] is not None and base["temp"] is not None else None
        env = {
            "humidity": range_score(v["humidity"], ENV_LIMITS["humidity"]),
            "ammonia": range_score(v["ammonia"], ENV_LIMITS["ammonia"]),
            "co2": range_score(v["co2"], ENV_LIMITS["co2"]),
            "temp": range_score(temp_gap, ENV_LIMITS["temp"]),
        }
        env_driver = max(env, key=env.get)
        components = {
            "cough": rise_score(dev["cough"], scale["cough"]),
            "activity": drop_score(dev["activity"], scale["activity"]),
            "feed": drop_score(dev["feed"], scale["feed"]),
            "water": drop_score(dev["water"], scale["water"]),
            "mortality": rise_score(dev["mortality"], scale["mortality"]),
            "eggs": drop_score(dev["eggs"], scale["eggs"]),
            "posture": rise_score(dev["posture"], scale["posture"]),
            "environment": env[env_driver],
            "biosecurity": clamp(bio_scores[i]) if bio_scores else 0.0,
        }
        risk = round(sum(w * components[k] for k, w in weights.items()))
        level = level_for(risk, profile)

        prev = values[i - 1]["weight"] if i > 0 else None
        adg = v["weight"] - prev if v["weight"] is not None and prev is not None else None

        rules = profile["classic"]
        classic = (
            any(dev[k] is not None and dev[k] <= -rules[k] for k in ("feed", "activity", "eggs") if k in rules)
            or (dev["mortality"] is not None and dev["mortality"] >= rules["mortality"])
        )
        days.append({
            "date": row["date"],
            "animal_count": _num(row.get("animal_count")),
            "values": {**v, "adg": adg},
            "baseline": base,
            "dev": dev,
            "components": components,
            "env": env,
            "env_driver": env_driver,
            "risk": risk,
            "level": level,
            "status": status_for(level),
            "warned": risk >= watch,
            "classic_visible": bool(classic),
            "notes": row.get("notes"),
        })
    return days


def contributors(day: dict, profile: dict) -> list[dict]:
    """Share of today's risk score explained by each signal (sums to ~100%)."""
    points = {k: w * day["components"][k] for k, w in profile["weights"].items()}
    total = sum(points.values())
    if total <= 0:
        return []
    out = [
        {"key": k, "points": round(p, 1), "share": round(p / total * 100), "anomaly": round(day["components"][k]),
         "weight": profile["weights"][k]}
        for k, p in points.items() if p / total >= 0.03
    ]
    return sorted(out, key=lambda c: -c["points"])


def detection(days: list[dict]) -> dict | None:
    """When did the engine first warn in the current episode, and when would it be visible classically?"""
    if not days or not days[-1]["warned"]:
        return None
    start = len(days) - 1
    while start > 0 and days[start - 1]["warned"]:
        start -= 1
    classic = next((i for i in range(start, len(days)) if days[i]["classic_visible"]), None)
    w0 = max(0, start - 2)  # show two calm days before the first warning
    return {
        "window_start": w0,
        "ai_day": start - w0 + 1,
        "classic_day": classic - w0 + 1 if classic is not None else None,
        "window": [{"day": i - w0 + 1, "date": days[i]["date"], "risk": days[i]["risk"], "level": days[i]["level"],
                    "status": days[i]["status"]} for i in range(w0, len(days))],
        "ai_index": start,
        "ai_date": days[start]["date"],
        "ai_risk": days[start]["risk"],
        "ai_level": days[start]["level"],
        "classic_index": classic,
        "classic_date": days[classic]["date"] if classic is not None else None,
        "lead_days": classic - start if classic is not None else None,
    }
