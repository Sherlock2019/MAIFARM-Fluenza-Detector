"""Demo farm generator.

The demo data is rebuilt on every backend start so that "today" in the demo is
always the real current date. Values are deterministic (fixed random seed).
"""
from __future__ import annotations

import random
from datetime import date, timedelta

from .db import connect, upsert_readings

DAYS = 30
DEMO_FARM = "Green Valley Livestock Farm"

# Gentle repeating wiggle used for the scripted houses. Half of the values sit
# exactly on the normal value, so the rolling-median baseline equals the normal value.
PATTERN = [0, 1, 0, -1, 0, 0.5, 0, -0.5]

# metric: (wiggle amplitude, amplitude is relative?)
METRICS = {
    "feed": (0.012, True), "water": (0.015, True), "activity": (0.010, True), "cough": (0.06, True),
    "eggs": (0.006, True), "humidity": (1.5, False), "temp": (0.4, False), "ammonia": (1.0, False),
    "co2": (60, False), "vent": (2.0, False), "feeder": (0.02, True), "drinker": (0.02, True),
    "distress": (0.06, True), "sneeze": (0.08, True), "vocal": (0.08, True), "acoustic": (0.01, True),
    "inactive": (0.05, True), "active": (0.01, True), "clustering": (0.05, True), "open_beak": (0.10, True),
    "posture": (0.10, True), "balance": (0.10, True), "immobile": (0.10, True), "abn_eggs": (0.08, True),
}
# Scenario overrides for these are a % change vs normal; all other keys are absolute values.
PCT_KEYS = {"feed", "water", "activity", "eggs", "feeder", "drinker"}


# ---------------------------------------------------------------- poultry (lead demo)

# House C-04: the 5-day influenza-like outbreak story (Day 1 .. Day 5 = today).
POULTRY_STORY = [
    {},
    {"humidity": 79, "cough": 10, "clustering": 24, "vent": 82},
    {"cough": 19, "activity": -9, "feeder": -6, "drinker": -3, "feed": -3, "water": -2, "eggs": -1,
     "humidity": 81, "vent": 74, "inactive": 10, "active": 84, "clustering": 31, "open_beak": 4, "posture": 3,
     "balance": 1, "immobile": 6, "sneeze": 8, "distress": 6, "vocal": 3, "acoustic": 94},
    {"cough": 31, "activity": -16, "feed": -10, "water": -7, "eggs": -4, "feeder": -11, "drinker": -7,
     "humidity": 83, "vent": 66, "co2": 2200, "deaths": 8, "inactive": 14, "active": 78, "clustering": 45,
     "open_beak": 7, "posture": 5, "balance": 2, "immobile": 11, "sneeze": 13, "distress": 7.5, "vocal": 5,
     "acoustic": 86, "abn_eggs": 2.0},
    {"cough": 52, "activity": -25, "feed": -18, "water": -9, "eggs": -9, "feeder": -19, "drinker": -10,
     "humidity": 84, "vent": 60, "co2": 2400, "ammonia": 21, "deaths": 11, "inactive": 19, "active": 71,
     "clustering": 62, "open_beak": 12, "posture": 9, "balance": 4, "immobile": 19, "sneeze": 21, "distress": 9,
     "vocal": 8, "acoustic": 78, "abn_eggs": 3.1},
]
# A slower 6-day drift that ends in WATCH.
POULTRY_DRIFT = [
    {"cough": 8.4, "activity": -2, "feed": -1, "water": -1, "eggs": -1, "ammonia": 22},
    {"cough": 9.6, "activity": -3, "feed": -2, "water": -2, "eggs": -1, "ammonia": 24, "deaths": 6},
    {"cough": 10.8, "activity": -5, "feed": -3, "water": -3, "eggs": -2, "ammonia": 26, "deaths": 7},
    {"cough": 11.7, "activity": -6, "feed": -4, "water": -3, "eggs": -2, "ammonia": 27, "deaths": 8},
    {"cough": 12.3, "activity": -7, "feed": -5, "water": -4, "eggs": -3, "ammonia": 28, "deaths": 9},
    {"cough": 12.6, "activity": -7, "feed": -5, "water": -4, "eggs": -3, "ammonia": 29, "deaths": 9},
]
HUMID = [{"humidity": 74}, {"humidity": 76}, {"humidity": 77}]

POULTRY = {
    "base": {"temp": 22.0, "co2": 1500, "vent": 90, "adg": 0.0, "eggs": 92.0, "deaths": 5, "feeder": 14.0,
             "drinker": 22.0, "distress": 5.0, "sneeze": 3.0, "vocal": 2.0, "acoustic": 100.0, "inactive": 7.0,
             "active": 88.0, "clustering": 22.0, "open_beak": 1.0, "posture": 2.0, "balance": 0.5,
             "immobile": 3.0, "abn_eggs": 1.2},
    "barns": [
        dict(barn="C-01", count=10000, breed="ISA Brown layers", age=210, weight=1.90, feed=0.125, water=0.210,
             activity=90, cough=7, humidity=64, ammonia=11),
        dict(barn="C-02", count=10000, breed="ISA Brown layers", age=238, weight=1.93, feed=0.127, water=0.213,
             activity=88, cough=6, humidity=65, ammonia=14, scripted=True, scenario=POULTRY_DRIFT,
             biosecurity="Passed - 20 days ago"),
        dict(barn="C-03", count=10000, breed="Lohmann Brown layers", age=196, weight=1.88, feed=0.124, water=0.208,
             activity=91, cough=6, humidity=63, ammonia=10),
        dict(barn="C-04", count=10000, breed="ISA Brown layers", age=224, weight=1.92, feed=0.125, water=0.210,
             activity=91, cough=7, humidity=67, ammonia=12, scripted=True, scenario=POULTRY_STORY,
             last_movement="No birds moved in the last 30 days", biosecurity="3 open warnings this week"),
        dict(barn="C-05", count=10000, breed="Lohmann Brown layers", age=203, weight=1.89, feed=0.125, water=0.210,
             activity=90, cough=6, humidity=64, ammonia=10),
        dict(barn="C-06", count=10000, breed="ISA Brown layers", age=189, weight=1.87, feed=0.123, water=0.207,
             activity=91, cough=6, humidity=64, ammonia=10, scenario=HUMID),
    ],
    # house: (vaccine, last dose days ago, next dose in days, vaccinated, due, overdue, missing)
    "vacc": {
        "C-01": ("Vaccine A", 19, 9, 10000, 0, 0, 0),
        "C-02": ("Vaccine A", 17, 11, 10000, 0, 0, 0),
        "C-03": ("Vaccine A", 15, 13, 10000, 0, 0, 0),
        "C-04": ("Vaccine B", 29, -1, 9400, 0, 360, 240),
        "C-05": ("Vaccine A", 20, 5, 8500, 1500, 0, 0),
        "C-06": ("Vaccine B", 12, 16, 10000, 0, 0, 0),
    },
    # (days ago, time, house, category, title, detail, action, status, points)
    "biosecurity": [
        (4, "06:40", "C-04", "Wild-bird exposure", "Wild birds observed near House C-04 air inlets",
         "The north inlet camera recorded wild birds for 25 minutes.",
         "Check inlet netting and remove feed spills outside the house.", "warning", 30),
        (3, "14:05", "C-04", "Vehicle entry", "Vehicle V-204 entered Farm Gate 2",
         "Previous poultry-site visit: yesterday. Vehicle disinfection: NOT CONFIRMED. Delivery point: House C-04.",
         "Verify disinfection before poultry-house access.", "warning", 40),
        (2, "22:14", "C-04", "Door access", "Unscheduled door access at House C-04",
         "Door opened outside the planned rounds. No entry in the visitor log.",
         "Confirm who entered and whether boots and clothing were changed.", "warning", 20),
        (8, "09:00", None, "Poultry transfers", "No poultry transfers in the last 14 days",
         "Last transfer: pullets placed 9 weeks ago.", "", "ok", 0),
        (6, "09:10", "C-01", "Visitor entry", "Veterinary technician visit - House C-01",
         "Visitor log signed. Boot dip and clothing change confirmed.", "", "ok", 0),
        (5, "11:30", None, "Vehicle entry", "Feed truck V-118 entered Farm Gate 1",
         "Disinfection confirmed at the wheel wash.", "", "ok", 0),
        (4, "15:20", "C-03", "Equipment transfers", "Egg trays moved from store to House C-03",
         "Trays washed and disinfected before transfer.", "", "ok", 0),
        (2, "08:00", None, "Disinfection record", "Weekly gate disinfection completed",
         "Wheel wash and foot baths refilled.", "", "ok", 0),
        (1, "10:15", "C-06", "Door access", "Scheduled maintenance access - House C-06",
         "Planned ventilation service. Entry logged.", "", "ok", 0),
        (0, "07:30", "C-02", "Visitor entry", "Farm staff morning round - House C-02",
         "Entry logged. Boot dip confirmed.", "", "ok", 0),
    ],
}


# ---------------------------------------------------------------- pigs (secondary demo)

PIG_STORY = [
    {},
    {"humidity": 78, "vent": 80},
    {"cough": 8, "activity": -5.5, "feed": -1.2, "water": -0.7, "humidity": 82, "vent": 72},
    {"cough": 10.4, "feed": -6, "water": -3, "activity": -11, "humidity": 84, "vent": 62, "co2": 2300,
     "adg_factor": 0.82},
    {"cough": 13.8, "feed": -13, "water": -8, "activity": -18, "humidity": 86, "vent": 55, "co2": 2600,
     "adg_factor": 0.65, "deaths": 3},
]
PIG_DRIFT = [
    {"cough": 6.5, "activity": -2, "feed": -1, "water": -1, "ammonia": 22},
    {"cough": 7.25, "activity": -3, "feed": -2, "water": -2, "ammonia": 24},
    {"cough": 7.75, "activity": -4, "feed": -3, "water": -2, "ammonia": 26, "deaths": 2},
    {"cough": 8.0, "activity": -5, "feed": -4, "water": -3, "ammonia": 27, "deaths": 2},
    {"cough": 8.25, "activity": -5, "feed": -4, "water": -3, "ammonia": 28, "deaths": 4},
    {"cough": 8.0, "activity": -5, "feed": -4, "water": -3, "ammonia": 29, "deaths": 4},
]

PIG = {
    "base": {"temp": 24.5, "co2": 1700, "vent": 88, "adg": 0.85, "deaths": 1},
    "barns": [
        dict(barn="P-01", count=820, breed="Landrace x Yorkshire", age=96, weight=58, feed=2.50, water=6.5,
             activity=92, cough=4, humidity=66, ammonia=12),
        dict(barn="P-02", count=760, breed="Duroc cross", age=110, weight=70, feed=2.70, water=7.0,
             activity=90, cough=5, humidity=67, ammonia=13),
        dict(barn="P-03", count=790, breed="Landrace x Yorkshire", age=102, weight=63, feed=2.45, water=6.4,
             activity=89, cough=5, humidity=68, ammonia=15, scripted=True, scenario=PIG_DRIFT,
             medication="Vet-prescribed treatment course ended 18 days ago",
             biosecurity="Passed - 20 days ago"),
        dict(barn="P-04", count=810, breed="Duroc cross", age=104, weight=65, feed=2.55, water=6.7,
             activity=91, cough=4, humidity=69, ammonia=13, scripted=True, scenario=PIG_STORY,
             last_movement="42 animals moved in 9 days ago", biosecurity="Inspection due"),
        dict(barn="P-05", count=840, breed="Pietrain cross", age=88, weight=52, feed=2.35, water=6.2,
             activity=93, cough=4, humidity=67, ammonia=12, scenario=HUMID),
        dict(barn="P-06", count=830, breed="Landrace x Yorkshire", age=92, weight=55, feed=2.40, water=6.3,
             activity=92, cough=4, humidity=65, ammonia=11),
    ],
    "vacc": {
        "P-01": ("Vaccine A", 19, 9, 820, 0, 0, 0),
        "P-02": ("Vaccine A", 20, 5, 594, 166, 0, 0),
        "P-03": ("Vaccine B", 29, -1, 616, 78, 71, 25),
        "P-04": ("Vaccine A", 17, 11, 810, 0, 0, 0),
        "P-05": ("Vaccine B", 12, 16, 840, 0, 0, 0),
        "P-06": ("Vaccine A", 15, 13, 830, 0, 0, 0),
    },
    "biosecurity": [],
}


def _barn_rows(farm_type: str, cfg: dict, base: dict, today: date, rnd: random.Random) -> list[dict]:
    scenario = cfg.get("scenario", [])
    scripted = cfg.get("scripted", False)
    normal = {**base, **cfg}
    weight = cfg["weight"]
    count = cfg["count"]
    rows = []
    for i in range(DAYS):
        ov_index = i - (DAYS - len(scenario))
        ov = scenario[ov_index] if ov_index >= 0 else {}
        v = {}
        for phase, (key, (amp, relative)) in enumerate(METRICS.items()):
            n = normal.get(key)
            if n is None:
                v[key] = None
                continue
            if scripted:
                # scripted event days sit exactly on their target values
                wobble = 0 if ov_index >= 0 else PATTERN[(i + phase) % 8]
            else:
                wobble = max(-1.0, min(1.0, rnd.gauss(0, 0.5)))
            v[key] = n * (1 + amp * wobble) if relative else n + amp * wobble
            if key in ov:
                v[key] = v[key] * (1 + ov[key] / 100) if key in PCT_KEYS else ov[key]
        if "deaths" in ov:
            deaths = ov["deaths"]
        elif scripted:
            deaths = base["deaths"]
        else:
            deaths = rnd.choice([base["deaths"] - 1, base["deaths"], base["deaths"], base["deaths"] + 1])
        weight += base["adg"] * ov.get("adg_factor", 1)
        eggs = round(v["eggs"] / 100 * count) if v["eggs"] is not None else None

        def r(key, digits=2):
            return round(v[key], digits) if v[key] is not None else None

        rows.append({
            "source": "demo", "farm_type": farm_type, "farm": DEMO_FARM, "barn": cfg["barn"],
            "date": (today - timedelta(days=DAYS - 1 - i)).isoformat(),
            "animal_count": count,
            "feed_kg": round(v["feed"] * count, 2),
            "water_l": round(v["water"] * count, 2),
            "avg_weight": round(weight, 2),
            "mortality": deaths,
            "activity": r("activity"), "cough_events": r("cough"),
            "temp": r("temp", 1), "humidity": r("humidity", 1), "ammonia": r("ammonia", 1),
            "co2": r("co2", 0), "ventilation": r("vent", 0),
            "egg_production": eggs,
            "abnormal_eggs": round(eggs * v["abn_eggs"] / 100) if eggs is not None else None,
            "feeder_visits": r("feeder"), "drinker_visits": r("drinker"),
            "inactive_pct": r("inactive", 1), "active_pct": r("active", 1), "clustering": r("clustering", 1),
            "open_beak": r("open_beak"), "posture_events": r("posture"), "balance_events": r("balance"),
            "immobile_birds": r("immobile", 0),
            "distress_events": r("distress"), "sneeze_events": r("sneeze"), "vocal_events": r("vocal"),
            "acoustic": r("acoustic", 1),
        })
    return rows


def seed_demo() -> None:
    today = date.today()
    with connect() as conn:
        for table in ("readings", "barns", "vaccinations", "biosecurity_events"):
            conn.execute(f"DELETE FROM {table} WHERE source = 'demo'")
        for farm_type, farm in (("poultry", POULTRY), ("pig", PIG)):
            rnd = random.Random(42)
            for cfg in farm["barns"]:
                upsert_readings(conn, _barn_rows(farm_type, cfg, farm["base"], today, rnd))
                conn.execute(
                    "INSERT INTO barns VALUES (?,?,?,?,?,?,?,?)",
                    ("demo", farm_type, cfg["barn"], cfg["breed"], cfg["age"],
                     cfg.get("biosecurity", "Passed - 12 days ago"),
                     cfg.get("last_movement", "No movement in the last 21 days"),
                     cfg.get("medication", "None in the last 30 days")),
                )
                vaccine, last_ago, next_in, vaccinated, due, overdue, missing = farm["vacc"][cfg["barn"]]
                conn.execute(
                    "INSERT INTO vaccinations (source, farm_type, barn, animals, vaccine, last_dose, next_dose,"
                    " vaccinated, due, overdue, missing) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                    ("demo", farm_type, cfg["barn"], cfg["count"], vaccine,
                     (today - timedelta(days=last_ago)).isoformat(),
                     (today + timedelta(days=next_in)).isoformat(),
                     vaccinated, due, overdue, missing),
                )
            for days_ago, time, barn, category, title, detail, action, status, points in farm["biosecurity"]:
                conn.execute(
                    "INSERT INTO biosecurity_events (source, farm_type, date, time, barn, category, title, detail,"
                    " action, status, points) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                    ("demo", farm_type, (today - timedelta(days=days_ago)).isoformat(), time, barn, category,
                     title, detail, action, status, points),
                )
