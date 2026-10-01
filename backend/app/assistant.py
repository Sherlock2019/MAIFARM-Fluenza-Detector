"""Ask AIFARM DOCTOR: a farm-health-only assistant that answers from the current farm analysis.

No external AI service is used. Questions are matched to a small set of
farm-health intents and answered only with the numbers the engine computed,
so it cannot invent diseases or data.
"""
from __future__ import annotations

import re

SUGGESTIONS = [
    "Why is {unit} {top} high risk?",
    "What changed today?",
    "Are {cough} increasing?",
    "Which {unit_l} is most abnormal?",
    "Which {unit_l} has the biggest feed drop?",
    "Are vaccinations up to date?",
    "Were there any biosecurity problems?",
    "Why did the risk score increase?",
    "What should I inspect first?",
]

DISCLAIMER = "_AI recommends. Humans decide. This is decision support, not a diagnosis._"


def suggestions(farm: dict) -> list[str]:
    labels = farm["labels"]
    top = farm["top_barn"] or ("C-04" if farm["farm_type"] == "poultry" else "P-04")
    out = [s.format(unit=labels["unit"], unit_l=labels["unit"].lower(), top=top, cough=labels["cough"].lower())
           for s in SUGGESTIONS]
    if farm["farm_type"] != "poultry":
        out = [s for s in out if "biosecurity" not in s]
    return out


def _norm(text: str) -> str:
    return re.sub(r"[^a-z0-9]", "", text.lower())


def _find_barn(question: str, farm: dict):
    q = _norm(question)
    for b in sorted(farm["barns"], key=lambda b: -len(b["barn"])):
        if _norm(b["barn"]) in q:
            return b
    return None


def _pct(v) -> str:
    return "n/a" if v is None else f"{v:+.0f}%"


def _why(b: dict, farm: dict) -> str:
    unit = farm["labels"]["unit"]
    e = b["explanation"]
    lines = [f"**{unit} {b['barn']} — {farm['labels']['risk'].lower()} {b['risk']}/100 ({b['level']})**", "",
             e["summary"]]
    if e["signals"]:
        lines += ["", "Main signals:"] + [f"{i}. {s}" for i, s in enumerate(e["signals"], 1)]
    for extra in (e["timing"], e["context"]):
        if extra:
            lines += ["", extra]
    lines += ["", "**Recommended:**"] + [f"- {r}" for r in e["recommended"]]
    if e["checks"]:
        lines += ["", "Check:"] + [f"- {c}" for c in e["checks"]]
    if e["disclaimer"]:
        lines += ["", e["disclaimer"]]
    return "\n".join(lines)


def _changed(b: dict, farm: dict, back: int) -> str:
    labels = farm["labels"]
    days = b["days"]
    then = days[-1 - back] if len(days) > back else days[0]
    now = days[-1]
    names = [("cough", labels["cough"]), ("activity", labels["activity"]), ("feed", "Feed intake"),
             ("water", "Water intake"), ("eggs", "Egg production"), ("mortality", "Mortality"),
             ("humidity", "Humidity")]
    since = "yesterday" if back == 1 else then["date"]
    lines = [f"**What changed in {b['barn']} since {since}**", "",
             f"- Risk score: {then['risk']} ({then['level']}) → {now['risk']} ({now['level']})"]
    for key, name in names:
        a, z = then["values"][key], now["values"][key]
        if a is None or z is None:
            continue
        if key == "mortality":
            lines.append(f"- {name}: {a:.2f}% → {z:.2f}%")
        elif key == "humidity":
            lines.append(f"- {name}: {a:.0f}% → {z:.0f}%")
        elif a:
            lines.append(f"- {name}: {(z - a) / a * 100:+.0f}% ({a:.3g} → {z:.3g})")
    d = b["detection"]
    if d:
        lines += ["", f"AIFARM DOCTOR first raised a warning on {d['ai_date']} ({d['ai_level']})."]
    if back == 1:
        others = [o["barn"] for o in farm["barns"] if o is not b and abs(o["days"][-1]["risk"] - o["days"][-2 if len(o["days"]) > 1 else -1]["risk"]) < 5]
        if others:
            lines += ["", f"No significant change since yesterday in {', '.join(others)}."]
    return "\n".join(lines)


def _attention(farm: dict) -> str:
    unit = farm["labels"]["unit"]
    risky = sorted([b for b in farm["barns"] if b["warned"]], key=lambda b: -b["risk"])
    if not risky:
        return f"No {unit.lower()} needs urgent attention today. All risk scores are in the LOW range."
    lines = [f"**{len(risky)} {unit.lower()}{'s' if len(risky) > 1 else ''} need attention today:**", ""]
    for b in risky:
        lines.append(f"- **{b['barn']}** — {b['risk']}/100 ({b['level']}): {b['pattern'].lower()}.")
    for a in farm["alerts"]:
        if a["type"] == "environment":
            lines.append(f"- **{a['barn']}** — environment: {a['message']}")
    return "\n".join(lines)


def _vaccines(farm: dict) -> str:
    v = farm["vaccination"]
    s = v["summary"]
    animals = farm["labels"]["animals"]
    lines = [f"**Vaccination compliance: {s['compliance']}%** ({s['vaccinated']:,} of {s['total']:,} {animals})", ""]
    overdue = [r for r in v["rows"] if r["overdue"] > 0]
    due = [r for r in v["rows"] if r["due"] > 0]
    missing = [r for r in v["rows"] if r["missing"] > 0]
    lines.append("Overdue:" if overdue else "No vaccinations are overdue.")
    lines += [f"- {r['barn']}: {r['overdue']:,} {animals} overdue for {r['vaccine']}"
              + (f" (was due {r['next_dose']})" if r["next_dose"] else "") for r in overdue]
    if due:
        lines += ["", "Due this week:"] + [f"- {r['barn']}: {r['due']:,} {animals} ({r['vaccine']})" for r in due]
    if missing:
        lines += ["", "Missing records:"] + [f"- {r['barn']}: {r['missing']:,} {animals}" for r in missing]
    lines += ["", "Vaccination status does not by itself confirm or exclude infection. Any change to the "
                  "vaccination program should be reviewed by your veterinarian."]
    return "\n".join(lines)


def _biosecurity(farm: dict) -> str:
    bio = farm["biosecurity"]
    if not bio["events"]:
        return "No biosecurity records are available for this farm."
    if not bio["warnings"]:
        return (f"No open biosecurity warnings in the last {bio['window_days']} days. "
                f"{len(bio['events'])} records were logged and all were confirmed.")
    lines = [f"**{len(bio['warnings'])} biosecurity warning{'s' if len(bio['warnings']) > 1 else ''} "
             f"in the last {bio['window_days']} days:**", ""]
    for e in bio["warnings"]:
        where = f" ({e['barn']})" if e["barn"] else ""
        lines.append(f"- **{e['date']} — {e['title']}**{where}. {e['detail']} Risk contribution: "
                     f"+{e['contribution']:g} points. Action: {e['action']}")
    return "\n".join(lines)


def _biggest(b: dict, farm: dict) -> str:
    if not b["contributors"]:
        return f"{farm['labels']['unit']} {b['barn']} has no meaningful risk contributors right now."
    top = b["contributors"][0]
    lines = [f"**{top['label']}** is the biggest driver of the risk score in {b['barn']} "
             f"({top['share']}% of {b['risk']}/100).", "", "All contributors:"]
    lines += [f"- {c['label']}: {c['share']}%" for c in b["contributors"]]
    return "\n".join(lines)


def _metric_list(farm: dict, key: str, title: str, bad_below: float | None = None, bad_above: float | None = None) -> str:
    rows = []
    for b in farm["barns"]:
        d = b["dev"][key]
        if d is not None:
            rows.append((b["barn"], d, (bad_below is not None and d <= bad_below) or (bad_above is not None and d >= bad_above)))
    rows.sort(key=lambda r: r[1], reverse=bad_above is not None)
    flagged = [r for r in rows if r[2]]
    unit = farm["labels"]["unit"]
    if not rows:
        return "There is no data for that signal yet."
    if not flagged:
        return f"No {unit.lower()} shows {title} right now. All are close to their normal baseline."
    lines = [f"**{unit}s with {title}** (largest first):", ""]
    lines += [f"- **{barn}**: {_pct(d)} vs its normal baseline" for barn, d, _ in flagged]
    ok = [r[0] for r in rows if not r[2]]
    if ok:
        lines += ["", f"Within normal range: {', '.join(ok)}."]
    return "\n".join(lines)


def _environment(farm: dict) -> str:
    lines = ["**Environment today:**", ""]
    for b in farm["barns"]:
        v = b["values"]
        parts = []
        if v["humidity"] is not None:
            parts.append(f"humidity {v['humidity']:.0f}%")
        if v["ammonia"] is not None:
            parts.append(f"ammonia {v['ammonia']:.0f} ppm")
        if v["temp"] is not None:
            parts.append(f"{v['temp']:.1f}°C")
        flag = " ⚠ above comfort range" if b["components"]["environment"] >= 30 else ""
        lines.append(f"- **{b['barn']}**: {', '.join(parts) or 'no data'}{flag}")
    return "\n".join(lines)


def _mortality(farm: dict) -> str:
    lines = ["**Mortality today:**", ""]
    for b in farm["barns"]:
        m, base = b["values"]["mortality"], b["baseline"]["mortality"]
        if m is None:
            continue
        flag = " ⚠ above normal" if b["components"]["mortality"] >= 15 else ""
        lines.append(f"- **{b['barn']}**: {m:.2f}% (normal {base:.2f}%){flag}")
    return "\n".join(lines)


def _inspect_first(farm: dict, top: dict) -> str:
    unit = farm["labels"]["unit"]
    if not top["warned"]:
        return f"Nothing urgent. All {unit.lower()}s are in the LOW risk range, so a routine round is enough."
    e = top["explanation"]
    lines = [f"**Start with {unit} {top['barn']}** (risk {top['risk']}/100 — {top['pattern'].lower()}).", "", "Check:"]
    lines += [f"- {c}" for c in e["checks"]]
    if top["response_plan"]:
        lines += ["", "Then follow the response plan: restrict movement, review records, and contact your "
                      "veterinarian. Laboratory confirmation is required for any diagnosis."]
    return "\n".join(lines)


def _briefing(farm: dict) -> str:
    b = farm["briefing"]
    lines = [f"**Farm health: {b['health_score']}/100**", ""]
    for i, p in enumerate(b["priorities"], 1):
        lines.append(f"{i}. **{p['title']}** {p['reason']}")
    if b["note"]:
        lines += ["", b["note"]]
    return "\n".join(lines)


def answer(question: str, farm: dict) -> dict:
    labels = farm["labels"]
    if not farm["has_data"]:
        return {"answer": "There is no farm data yet. Add data on the Data Import page, or switch to the Demo Farm."}

    q = question.lower()
    barn = _find_barn(question, farm)
    top = max(farm["barns"], key=lambda b: b["risk"])

    def has(*words):
        return any(w in q for w in words)

    if has("vaccin", "dose", "overdue"):
        text = _vaccines(farm)
    elif has("biosecur", "visitor", "vehicle", "disinfect", "wild bird", "wild-bird"):
        text = _biosecurity(farm)
    elif has("changed", "change in", "this week", "last week", "trend"):
        barn = barn or top
        text = _changed(barn, farm, 1 if "today" in q or "yesterday" in q else 7)
    elif has("biggest risk", "which metric", "caused", "contribut", "driver", "main reason", "score increase",
             "risk increase"):
        barn = barn or top
        text = _biggest(barn, farm)
    elif has("inspect", "first", "priorit", "what should", "what do i do", "action"):
        barn = top
        text = _inspect_first(farm, top)
    elif has("most abnormal", "worst", "most at risk", "highest risk"):
        barn = top
        text = _why(top, farm)
    elif has("feed"):
        text = _metric_list(farm, "feed", "declining feed consumption", bad_below=-3)
    elif has("water", "drink"):
        text = _metric_list(farm, "water", "declining water consumption", bad_below=-3)
    elif has("cough", "respir", "breath", "sneez", "sound"):
        text = _metric_list(farm, "cough", f"increasing {labels['cough'].lower()}", bad_above=30)
    elif has("egg"):
        text = _metric_list(farm, "eggs", "declining egg production", bad_below=-2)
    elif has("activ", "movement"):
        text = _metric_list(farm, "activity", f"reduced {labels['activity'].lower()}", bad_below=-4)
    elif has("mortal", "death", "died", "losses"):
        text = _mortality(farm)
    elif has("humid", "ammonia", "environment", "ventilat", "temperature", "co2"):
        text = _environment(farm)
    elif has("why", "explain", "high risk", "reason"):
        barn = barn or top
        text = _why(barn, farm)
    elif has("attention", "today", "which barn", "which house", "alert", "risk", "problem", "sick", "worr",
             "influenza", "flu", "outbreak"):
        text = _attention(farm)
    elif has("health", "summary", "brief", "overview", "status", "how is", "how are"):
        text = _briefing(farm)
    elif barn:
        text = _why(barn, farm)
    else:
        return {"answer": "I can only help with the health of this farm — risk scores, alerts, feed, water, "
                          f"{labels['activity'].lower()}, {labels['cough'].lower()}, mortality, environment, "
                          "vaccination and biosecurity. Try one of the suggested questions.",
                "off_topic": True}
    return {"answer": text + "\n\n" + DISCLAIMER, "barn": barn["barn"] if barn else None}
