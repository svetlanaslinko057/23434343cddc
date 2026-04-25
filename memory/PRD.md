# EVA-X / ATLAS DevOS — PRD

## Vision
Dev-studio OS: клиенты заказывают продукт, разработчики делают модули, платформа
сама маршрутизирует, оценивает, эскрует выплату и показывает реальный прогресс в деньгах.

## Surfaces
| Surface       | Stack                    | URL                                               |
|---------------|--------------------------|---------------------------------------------------|
| Mobile client | Expo SDK 54 + expo-router | `https://react-app-deploy-2.preview.emergentagent.com/` |
| Web admin     | React CRA + craco + Tailwind | `/api/web-ui/` (served by FastAPI staticfiles)    |
| Backend API   | FastAPI + motor (MongoDB) | `/api/*` (uvicorn :8001)                         |

## Deployment Status (current session)
- ✅ Backend started (FastAPI, uvicorn on :8001, all modules loaded — assignment_engine,
  acceptance_layer, time_tracking, event_engine, decomposition, decision_layer, etc.)
- ✅ MongoDB running, seed users + demo Acme project auto-seeded on startup.
- ✅ Web admin built (CRA → `/app/web/build`, ~450 kB gzipped main.js, homepage=/api/web-ui).
- ✅ Expo Metro serving mobile bundle on `:3000` (EVA-X landing loads).
- ✅ Emergent LLM Key configured (`EMERGENT_LLM_KEY` in backend/.env).
- ⚠️  Google OAuth **disabled** until `GOOGLE_CLIENT_ID` provided by user (password auth works).
- ⚠️  Email delivery (OTP) — **MOCKED** in backend (no SMTP provider configured yet).

## Product Flow
```
Estimate (mobile) → Auth (OTP/Google/password) → Booting →
Workspace (modules, review, payout) → Activity feed → Push notifications
```

## Seeded Data (on every backend start, idempotent)
**Quick-access users** (legacy):
- `admin@atlas.dev` / `admin123` — admin
- `john@atlas.dev` / `dev123` — senior developer
- `client@atlas.dev` / `client123` — client (rich demo data, see below)
- `multi@atlas.dev` / `multi123` — triple-role user
- `admin@devos.io` / `admin123` — legacy superadmin

**Client demo data (`backend/mock_seed.py`, marker `extra_demo_v1`)** — strictly schema-true, populates every collection used by the client surfaces:

| Surface       | Collection(s)                       | Mock content                                                                                    |
|---------------|-------------------------------------|------------------------------------------------------------------------------------------------|
| Home          | projects, modules, payouts, auto_actions, system_alerts | 3 projects (Acme + Mobile App Refresh + Internal Ops Tool), risk states (blocked/at_risk/healthy), 3 system actions visible |
| Projects      | projects, modules                   | 3 cards with progress bars + chips: 2 paused / 1 in progress / 1 in review                     |
| Activity      | modules.{started_at,review_at,completed_at} | 16 events across all 3 projects (started/review/completed), bucketed Today/Earlier   |
| Billing       | invoices, payouts (via /client/costs) | 6 invoices: 4 paid ($5,200) · 1 pending ($950, Pay-now) · 1 draft ($700). Summary: Earned $8,120 · Profit $3,050 |
| Profile       | support_tickets, client_notifications | 3 tickets (open/in_progress/resolved) inside Profile→Support sheet; 3 client notifications     |

## Key Architectural Modules
| Area                    | File                                          |
|-------------------------|-----------------------------------------------|
| Backend entry, routes   | `backend/server.py`                           |
| Client workspace agg    | `backend/client_workspace.py`                 |
| Client approve/reject   | `backend/client_acceptance.py`                |
| Module state machine    | `backend/module_execution.py` + `module_motion.py` |
| Payout 60/40 split      | `backend/client_acceptance.py` + `module_motion.py` |
| Push (single source)    | `backend/push_sender.py` + `_emit_notification` |
| Google OAuth            | `backend/google_auth.py` + `mobile_adapter.py`|
| Mobile auth context     | `frontend/src/auth.tsx`                       |
| Mobile workspace UI     | `frontend/app/workspace/[id].tsx`             |
| Web admin login         | `web/src/pages/ClientAuthPage.js`             |

## Retention Engine v1 — Return Loop (shipped)
**Why open the app right now.** Three bucket counter that surfaces only when at
least one item demands the client's attention.

| Endpoint | Purpose |
|----------|---------|
| `GET /api/client/attention` | `{pending_approvals, pending_payments, blocked_modules, total}` from raw collections — no aggregation |

Push triggers (3 — fired automatically by existing pipeline):
1. **Module ready for review** → `module_motion._emit_notification(type_="review_required")` already wired on `in_progress → review` transition.
2. **Payment required to continue development** → `_emit_notification(type_="payment_required")` newly hooked into `POST /api/billing/invoices` and the deliverable-publish path.
3. **Project waiting for your decision** → covered by the same `review_required` push (project stays in review until client acts).

UI surfaces:
- `frontend/app/client/home.tsx` — top-of-Home "Your product needs attention" CTA. Hidden when `total == 0`. Clicks straight into the first project's screen.
- `frontend/app/client/projects/[id].tsx` — passive pressure on module cards:
  - status=review → "Waiting for your approval · $X is ready to be delivered"
  - invoice pending → "Blocked by payment · pay to continue development" + Pay button.

## Next Steps (from user's product roadmap)
1. **Realtime activity** — wire mobile `frontend/src/realtime.ts` to live socket.io,
   replace polling in `/workspace` with live updates for approve/modules/money.
2. **Email delivery** — replace mocked OTP/notification email with real provider (SendGrid/Resend).
3. **Lead re-capture** — surface `/api/leads/by-email/pending` on `/client/home` ("We found your previous product plan → Continue building").
4. **OTP polish** — autofocus ✓, auto-submit on 6 digits ✓, success animation, 0.5–1s "Unlocking your workspace…" bridge before redirect.
5. **Build-mode copy** — reinforce "AI Build / AI + Engineering / Full Engineering" as a *decision* (speed/cost/reliability), not a feature trade-off.

## Expansion Engine v1 — Revenue Growth Layer (shipped)
**Second money engine on top of delivery loop.** Lets a client extend a live project
with curated add-on modules. The added module enters the standard pipeline at
`status="pending"` — no new flow, no upfront invoice. Billing happens at the
existing Approve → Invoice → Pay step.

| Endpoint | Purpose | Owner |
|----------|---------|-------|
| `GET  /api/client/modules/catalog` | 3 fixed catalog items (2FA $400 · Payments $500 · Analytics $600) | `server.py::expansion_catalog` |
| `POST /api/client/projects/{id}/modules/add` | Insert module + write to `auto_actions` (single shared bus) + emit `module.added` realtime | `server.py::add_expansion_module` |
| `GET  /api/activity/live` | Now also surfaces `added` events via `modules.added_at` | `server.py::get_live_activity` |

Mobile UI surfaces:
- `frontend/app/client/modules/catalog.tsx` — 3-card catalog screen
- Project screen `[id].tsx` — three placements:
  1. **Inline upsell** inside the Decision Engine block (highest conversion — next to Approve)
  2. **Contextual upsell** under any finished `auth`-typed module ("Add 2FA +$400")
  3. **"Improve your product" entry** — dashed-border block linking to the catalog

Recommendation rule (rule-based, no ML):
```
if has(auth) and not has(2fa) → 2fa
elif not has(payments)        → payments
elif not has(analytics)       → analytics
else                          → none
```
