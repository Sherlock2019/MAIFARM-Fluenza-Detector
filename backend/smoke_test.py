"""Quick end-to-end check of the API: run with `.venv/bin/python smoke_test.py` (needs httpx)."""
import json

from fastapi.testclient import TestClient

from app.main import app

KEYS = ("cough", "activity", "feed", "water", "eggs", "mortality")

with TestClient(app) as c:
    for ft in ("poultry", "pig"):
        f = c.get("/api/farm", params={"farm_type": ft}).json()
        print(ft, "health", f["health_score"], f["counts"], [(b["barn"], b["risk"], b["level"]) for b in f["barns"]])
        print(" vacc", f["vaccination"]["summary"], f["vaccination"]["insight"])
        b = c.get("/api/barns/" + f["top_barn"], params={"farm_type": ft}).json()
        for d in b["days"][-5:]:
            devs = {k: (round(d["dev"][k], 1) if d["dev"][k] is not None else None) for k in KEYS}
            print("  ", d["date"], d["risk"], d["level"], devs, d["values"]["humidity"],
                  "bio", d["components"]["biosecurity"], "classic", d["classic_visible"])
        det = b["detection"]
        print(" det ai_day", det["ai_day"], "classic_day", det["classic_day"], "lead", det["lead_days"])
        print(" contrib", [(x["label"], x["share"]) for x in b["contributors"]])
        print(" pattern", b["pattern"], "| plan steps", len(b["response_plan"]))
        print(" panel", [(p["label"], p["status"]) for p in b["panel"] if p["status"] != "NORMAL"])
        print(" brief", [p["title"] for p in f["briefing"]["priorities"]], f["briefing"]["note"])
        print(" alerts", [(a["severity"], a["type"], a["barn"]) for a in f["alerts"]])

    f = c.get("/api/farm").json()
    print("bio", [(e["title"], e["contribution"]) for e in f["biosecurity"]["warnings"]], f["biosecurity"]["scores"])
    for q in f["suggestions"] + ["what is bitcoin"]:
        print("Q:", q)
        print(c.post("/api/chat", json={"question": q}).json()["answer"][:700])
        print()

    ex = c.get("/api/import/example.csv").content
    p = c.post("/api/import/preview", files={"file": ("a.csv", ex)}).json()
    print("example needs mapping:", p["needs_mapping"], p["missing_required"], p["unmatched_columns"])
    alt = ex.replace(b"feed_kg", b"feed_tot").replace(b"water_l", b"h2o")
    p = c.post("/api/import/preview", files={"file": ("a.csv", alt)}).json()
    print("renamed needs mapping:", p["needs_mapping"], p["unmatched_columns"])
    m = p["mapping"]
    m.update(feed_kg="feed_tot", water_l="h2o")
    print(c.post("/api/import/commit", files={"file": ("a.csv", alt)}, data={"mapping": json.dumps(m)}).json())
    print(c.post("/api/readings", json={"barn": "C-09", "date": "2026-09-09", "animal_count": 500, "feed_kg": 60,
                                        "vaccination_status": "OK", "biosecurity_incident": "Visitor without log"}).json())
    u = c.get("/api/farm", params={"source": "user"}).json()
    print(u["health_score"], [(b["barn"], b["risk"], b["level"]) for b in u["barns"]], u["vaccination"]["summary"],
          len(u["biosecurity"]["warnings"]))
    print(c.delete("/api/user-data").json())
