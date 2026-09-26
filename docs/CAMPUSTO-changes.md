# CAMPUSTO — "Campus to Community" — Changes & Bug Fix Log

> **IQAC PMS** — Internal Quality Assurance Cell · Programme Management System
> Version: **1.0** (Sept 2026) · Roles: **SA / PA / PC / AO / FO / V**
> URLs — Admin console: `http://localhost:5173` · API: `http://localhost:8000/api/v1`
> OpenAPI: `http://localhost:8000/api/docs/` (Swagger) / `http://localhost:8000/api/redoc/`
> Admin login: `admin@university.edu` / `Admin@12345`
> Full project reference: `docs/PROJECT-REFERENCE.md`

Program: **Campus to Community** · short_code `CAMPUSTO`
id: `7d85c841-322e-41e3-980c-f36a7ee0aa88` · 3 days (2026-09-01 → 2026-09-03)
Date of this log: **2026-08-30**

This document records the code changes made to the backend to get the
CAMPUSTO program working end-to-end, plus the master-data refactor already
in flight. All fixes were verified against the live API (see
`CAMPUSTO-END-TO-END-WORKFLOW-TEST.md`).

---

## 1. Backend bugs fixed during the workflow test

### 1.1 Program audit 500 on any program PATCH
`backend/programs/views.py` — `perform_update`, `perform_create`,
`perform_destroy` wrote `AuditLog` with `after/before = serializer.data`,
which contains raw `uuid.UUID` objects (FK fields such as `program_type`,
`organizing_department`, `venue`, `program_coordinator`).
**Error:** `TypeError: Object of type UUID is not JSON serializable` on any
program PATCH.
**Fix:** added a module helper
```python
def _json_safe(data):
    return json.loads(json.dumps(data, default=str))
```
and wrapped `after=…`/`before=…` with `_json_safe(...)` in all three methods.

### 1.2 Attendance mark 500 — `UnboundLocalError`
`backend/attendance/views.py` — an inner `from programs.models import Program`
inside the `token` branch of `MarkAttendanceView.post` made `Program` local
to `post()`, so any reference to it raised
`UnboundLocalError: can't access local variable 'Program'`.
**Fix:** removed the redundant inner import (a module-level import already
exists). The `FoodToken` inner import was left in place (bound-before-use).

### 1.3 Participants-per-program list 500 — `AttributeError`
`backend/participants/urls.py` — `ProgramParticipantViewSet` is a
`ReadOnlyModelViewSet` (only `list`/`retrieve`), but the URL declared
`post → create` (and the detail route declared `patch → partial_update` and
`delete → destroy`). DRF `as_view` binds all declared actions, so **any**
request (even GET) raised `AttributeError: '…' object has no attribute 'create'`.
**Fix:** reduced the URL action maps to only the actions the viewset supports:
```python
path('program/<uuid:program_id>/', views.ProgramParticipantViewSet.as_view({'get': 'list'}))
path('program/<uuid:program_id>/<uuid:pk>/', views.ProgramParticipantViewSet.as_view({'get': 'retrieve'}))
```

### 1.4 Food QR generation produced 0 tokens — `participant.id` vs object
`backend/food/views.py` — `GenerateFoodQRView` computed
`eligible_participants` as a **set of `participant_id` UUIDs**
(`values_list('participant_id', flat=True)`) but then tested
`is_eligible = participant in eligible_participants` where `participant` is
a `Participant` **model instance**. A model instance is never equal to a
UUID, so `is_eligible` was always `False` and no `FoodToken`s were created,
even though `generate/` returned 200 with `generated_qrs: 0`.
**Fix:** compare by id — `is_eligible = participant.id in eligible_participants`.
Verified: `generate/` now returns `{"generated_qrs":5}` and creates 5 tokens.

### 1.5 Certificate config PUT 500 (two defects)
`backend/certificates/views.py`
- (a) `CertificateConfig.get_or_create(defaults={'template': request.data.get('template'), …})`
  assigned a **string** template id to the `template` FK, which required a
  `CertificateTemplate` instance →
  `ValueError: Cannot assign "…" : must be a CertificateTemplate instance`.
  **Fix:** resolve before creating:
  ```python
  defaults = {'eligibility_rule': request.data.get('eligibility_rule', {})}
  if request.data.get('template'):
      defaults['template'] = CertificateTemplate.objects.get(id=request.data['template'])
  config, created = CertificateConfig.objects.get_or_create(program=program, defaults=defaults)
  ```
- (b) `AuditLog… create(…, after=serializer.data, …)` failed with
  `TypeError: Object of type UUID is not JSON serializable` (the `template`
  field serializes to a UUID).
  **Fix:** added a module `_json_safe(data)` helper and wrapped the audit
  `after=` field. Verified: `PUT …/config/` now returns **200** and
  certificate generation + public verify work (**200**).

---

## 2. Master-data refactor (backend)

Completed earlier and verified this session:

- **participants:** model updated (removed `participant_type`-era leftovers);
  migration `participants/0003`.
- **programs:** model/serializer/view/url updates; migration `programs/0008`.
- New independent master-data fields exposed on `ProgramDetail`:
  `resource_persons_detail`, `target_departments_detail`, etc.
- Both migrations applied; `manage.py check` → **0 issues**.

## 3. Frontend `participant_type` cleanup (completed)

- `ParticipantsPage` — form state, load, `startEdit`, `handleSave`,
  form UI, table "Type" column, `titleCase` import all updated off
  `participant_type`.
- `ParticipantDetailPage` — removed the `type` stat block.
- Types in `api/participants.ts` — `Participant`, `StatusMatrixRow`,
  `ParticipantPayload`.
- `ProgramDetail` type — removed `resource_persons_detail` /
  `target_participant_types_detail` leftovers.
- Wizard `DaysStep` — per-day resource-person editor added with
  `DayResourcePerson` type; `resource_persons` added to `ProgramDayPayload`
  and `ProgramDay`.
- **Frontend build green** (Vite, ~460 kB).

---

## 4. Operational/setup notes

- Admin password reset to `Admin@12345` to enable programmatic login.
- CAMPUSTO registration schema restored/corrected to **7 fields** (stray
  bracket characters removed from the Gender radio options; identity keys:
  Full Name, Email, Contact No.).
- Workflow exercised: DRAFT → PUBLISHED → REG_OPEN → REG_CLOSED →
  ONGOING → COMPLETED → ARCHIVED.
- Recorded artifacts for CAMPUSTO:
  - 5 registrations (CAMPUSTO-0001…0005, status SUBMITTED)
  - 15 attendance records (5 participants × 3 days)
  - 3 food services / 15 QR tokens (2 claimed)
  - 5 feedback responses (100% response rate)
  - 5 certificates (CAMPUS-000001…000005, all verifiable — e.g.
    `GET /public/verify/CAMPUS-000001/` → `valid:true`)

---

## 5. Net effect

The CAMPUSTO program now runs cleanly through its entire life-cycle with no
server errors. See the companion workflow test doc for per-step request and
response bodies.

---

## 6. Addendum — Sept 2026 (project-wide hardening, affects CAMPUSTO)

The log above covers the original workflow-test bugs. Since then the project
received a production-hardening + premium-ERP pass (see `PROJECT-REFERENCE.md`
§10). CAMPUSTO-relevant deltas:

- **My QRs is day-aware** — attendance QRs are returned per `attendance_enabled`
  day (`attendance_qrs[]`); the lunch QR appears only on days with an active
  `FoodService` + `food_enabled`. CAMPUSTO now resolves **2 attendance + 2 lunch QRs**
  for participant `DEEKSHAR-0001` (a Day-2 LUNCH `FoodService` `a6e44f63` was created
  with rule `{"type":"registration_only"}`).
- **Daywise feedback removed** — `FeedbackInstance` gating by program *day* is gone;
  feedback pages list every `ACTIVE` instance for the program.
- **Security settings** — server now requires `SECRET_KEY` env (no fallback), `DEBUG`
  defaults off, and public links (notifications, certificate verify, My QRs) resolve via
  `PUBLIC_SITE_URL`/`FRONTEND_URL` instead of hardcoded localhost.
- Admin credentials remain **`admin@university.edu` / `Admin@12345`** (see §4).
