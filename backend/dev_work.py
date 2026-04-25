"""
Block 10.0 — Developer Work Hub (aggregator, READ-ORIENTED, MINIMAL)

One endpoint: GET /api/dev/work

1 screen = 1 question: "What should I do RIGHT NOW?"

Returns ONLY what the dev needs to act:
    - who am I            (developer.name + rank A/B/C/D)
    - what are my numbers (summary.paid/earned/pending + counts)
    - 1-line headline     ("1 active · 1 in QA · $100 pending")
    - 3 buckets           (active / qa / blocked)

Intentionally does NOT return:
    - combined/quality/reliability scores → dev profile surface, not here
    - marketplace list   → /api/marketplace owns that; we only count it
    - per-module paid/pending breakdown → already rolled up in summary
    - timestamps created_at/due_at → not used by "what to do now" UI
    - system_actions     → Operator's responsibility, never dev's
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List

from fastapi import APIRouter, Depends

router = APIRouter(prefix="/api", tags=["dev-work"])


def _rank_from_score(combined: float) -> str:
    """0..1 scale → letter. Single signal. No breakdown on dev screen."""
    if combined >= 0.85:
        return "A"
    if combined >= 0.70:
        return "B"
    if combined >= 0.55:
        return "C"
    return "D"


def _headline(active: int, qa: int, blocked: int, pending_usd: float) -> str:
    bits: List[str] = []
    if active:
        bits.append(f"{active} active")
    if qa:
        bits.append(f"{qa} in QA")
    if blocked:
        bits.append(f"{blocked} blocked")
    if not bits:
        bits.append("Nothing assigned — check the marketplace")
    if pending_usd > 0:
        bits.append(f"${int(pending_usd)} pending")
    return " · ".join(bits)


def init_router(db, get_current_user_dep):

    @router.get("/dev/work")
    async def dev_work(user=Depends(get_current_user_dep)) -> Dict[str, Any]:
        dev_id = user.user_id if hasattr(user, "user_id") else user["user_id"]

        # 1. Modules assigned to me
        mods = await db.modules.find(
            {"assigned_to": dev_id}, {"_id": 0},
        ).to_list(1000)

        # 2. Project titles
        pids = list({m.get("project_id") for m in mods if m.get("project_id")})
        title_by_pid: Dict[str, str] = {}
        if pids:
            prjs = await db.projects.find(
                {"project_id": {"$in": pids}},
                {"_id": 0, "project_id": 1, "name": 1, "title": 1},
            ).to_list(500)
            title_by_pid = {p["project_id"]: (p.get("name") or p.get("title") or "")
                            for p in prjs}

        # 3. Payouts — source of truth for earnings (same rule as Operator/Costs)
        mod_ids = [m["module_id"] for m in mods]
        by_mod: Dict[str, List[Dict[str, Any]]] = {}
        if mod_ids:
            po_query = {"$or": [
                {"module_id": {"$in": mod_ids}},
                {"developer_id": dev_id},
            ]}
        else:
            po_query = {"developer_id": dev_id}
        pos = await db.payouts.find(po_query, {"_id": 0}).to_list(5000)
        for po in pos:
            by_mod.setdefault(po.get("module_id") or "_direct", []).append(po)

        # 4. Developer rank (single letter)
        score = await db.developer_scores.find_one(
            {"developer_id": dev_id}, {"_id": 0},
        ) or {}
        combined = float(score.get("combined_score") or 0)
        if combined > 1.0:
            combined = combined / 100.0  # normalise 0..100 → 0..1

        # 5. Classify → active / qa / blocked + totals
        active: List[Dict[str, Any]] = []
        qa: List[Dict[str, Any]] = []
        blocked: List[Dict[str, Any]] = []

        tot_paid = tot_earned = tot_pending = 0.0

        for m in mods:
            mid = m["module_id"]
            payouts = by_mod.get(mid, [])
            paid    = sum(float(x.get("amount") or 0) for x in payouts if x.get("status") == "paid")
            earned  = sum(float(x.get("amount") or 0) for x in payouts if x.get("status") in ("approved", "paid"))
            pending = sum(float(x.get("amount") or 0) for x in payouts if x.get("status") == "pending")

            tot_paid    += paid
            tot_earned  += earned
            tot_pending += pending

            price = float(m.get("final_price") or m.get("price") or 0)
            budget = float(m.get("base_price") or price)  # what this task can earn the dev
            progress = (earned / budget) if budget > 0 else 0.0

            row = {
                "module_id":     mid,
                "module_title":  m.get("title") or "",
                "project_id":    m.get("project_id"),
                "project_title": title_by_pid.get(m.get("project_id") or "", ""),
                "status":        m.get("status") or "pending",
                "paused_by_system": (m.get("status") == "paused"
                                     and m.get("paused_by") == "guardian"),
                "progress_pct":  int(min(max(progress, 0.0), 1.0) * 100),
                "budget":        round(budget, 2),
                "earned":        round(earned, 2),
            }

            st = row["status"]
            if st == "paused":
                blocked.append(row)
            elif st == "review":
                qa.append(row)
            elif st in ("in_progress", "pending"):
                active.append(row)
            # Completed / done modules are intentionally dropped — the dev
            # screen is about "what to do now", not history.

        # 6. "Available" — just the count. The marketplace is its own screen.
        available_count = await db.modules.count_documents(
            {"assigned_to": None, "status": "pending"},
        )

        headline = _headline(len(active), len(qa), len(blocked), tot_pending)

        return {
            "developer": {
                "developer_id": dev_id,
                "name": (getattr(user, "name", None)
                         or (user.get("name") if isinstance(user, dict) else None)
                         or "Developer"),
                "rank": _rank_from_score(combined),
            },
            "summary": {
                "paid":    round(tot_paid, 2),
                "earned":  round(tot_earned, 2),
                "pending": round(tot_pending, 2),
                "active_count":    len(active),
                "qa_count":        len(qa),
                "blocked_count":   len(blocked),
                "available_count": available_count,
            },
            "headline": headline,
            "active":   active,
            "qa":       qa,
            "blocked":  blocked,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }

    return router
