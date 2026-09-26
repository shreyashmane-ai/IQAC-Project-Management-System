# IQAC PMS — Project Reference

> **IQAC PMS** — Internal Quality Assurance Cell · Programme Management System
> Version: **1.0** (Sept 2026) · Roles: **SA / PA / PC / AO / FO / V**
> URLs — Admin console: `http://localhost:5173` · API: `http://localhost:8000/api/v1`
> OpenAPI: `http://localhost:8000/api/docs/` (Swagger) / `http://localhost:8000/api/redoc/`
> Admin login: `admin@university.edu` / `Admin@12345` (see `docs/CAMPUSTO-changes.md`)

This document is a living reference to the whole IQAC PMS project as it currently
stands. It reflects the state of the codebase **after** the master-data refactor,
the feedback day-gating removal, the production-security hardening and the
premium-ERP UI pass (September 2026). Keep this in sync with the code as the
project evolves.

> Prefer this file over the requirement/HLD docs when the two disagree — the HLD may
> still describe the older master-table / daywise-feedback design.

---

## 1. What the project is

**IQAC PMS** (Internal Quality Assurance Cell — Programme Management System) is a
web application for planning, running and tracking academic programmes
(FDPs / seminars / workshops). It manages the full lifecycle of a programme:

- programme creation via a wizard (details, days, services, registration form)
- public self-registration from a configurable form
- attendance session/gate capture
- food eligibility and QR tokens
- feedback forms, quiz questions and analytics
- certificate generation
- reporting, notifications and document storage

---

## 2. Tech stack

### Backend — `backend/`
- **Python 3.13**, **Django ≥ 5.0,<6.0** (running **5.2.6**)
- **Django REST Framework ≥ 3.15** (running **3.17.1**) +
  `djangorestframework-simplejwt` (JWT auth) + **drf-spectacular 0.30** (OpenAPI)
- **MySQL** `iqac_pms` by default (PostgreSQL also supported via `DB_ENGINE`, see settings)
- DB driver: `mysqlclient` if installed, otherwise falls back to `pymysql`
  (`manage.py` calls `_ensure_db_driver()` which does `pymysql.install_as_MySQLdb()`)
- **Celery + django-celery-beat** for async jobs (notifications, exports)
- **django-storages** (document/media storage), **django-anymail** (email),
  **django-cors-headers**
- Tests: `pytest-django` declared in `requirements.txt` (**no test files exist yet**)
- Settings module: `config.settings` (env-driven via `DJANGO_SETTINGS_MODULE`
  and a decouple-style `config()` helper)

**Security defaults (production‑first, all env‑driven):** `SECRET_KEY` is **required**
(no fallback — the server refuses to start without it), `DEBUG` defaults to **False**,
`ALLOWED_HOSTS` empty (localhost only while `DEBUG=True`), optional
`SECURE_SSL_REDIRECT` / `SECURE_HSTS_SECONDS` / `SESSION_COOKIE_SECURE` /
`CSRF_COOKIE_SECURE`. Public links use `PUBLIC_SITE_URL` / `FRONTEND_URL`; CORS via
`CORS_ALLOWED_ORIGINS` (default `http://localhost:5173`).

### Frontend — `frontend/`
- **Vite ≥ 8** (running `^8.2.2`), **React 19** (`^19.2.8`), **TypeScript ~6.0**
- **react-router-dom 7** for routing, **axios** (`^1.20.0`) at `baseURL: '/api/v1'`
- **@tiptap** rich-text editor (starter-kit), **prosemirror** bundle
- Lint/type-check: `oxlint` + `tsc -b` (strict; `verbatimModuleSyntax`,
  `noUnusedLocals` / `noUnusedParameters`)
- Non-component exports live in `frontend/src/utils/*` and `frontend/src/hooks/*`
  so component files stay Fast-Refresh friendly; app-wide `ErrorBoundary` wraps all
  routes; every data fetch flows through the cancellable axios client in `api/client.ts`

### Run (dev)
```powershell
# backend  (from backend/)
python.exe manage.py migrate
python.exe manage.py runserver 0.0.0.0:8000 --noreload

# frontend dev server (from frontend/) -> http://localhost:5173
npm.cmd run dev

# production build + type-check
npm.cmd run build        # runs `tsc -b && vite build`
```

Backend runs on port **8000**, frontend dev server on **5173**.

---

## 3. Repository layout

```
IQAC PMS/
├── backend/
│   ├── config/            # settings, root urls, celery app
│   ├── core/              # base models (UUID, timestamps, soft-delete), auth
│   ├── programs/          # master data + Program, ProgramDay, services
│   ├── participants/      # Participant, Registration, waitlist, public registration
│   ├── attendance/        # AttendanceRecord, AttendanceSession, AttendanceGate
│   ├── food/              # FoodService, FoodEligibility, FoodToken, FoodClaim
│   ├── feedback/          # FeedbackInstance, FeedbackResponse, FeedbackAnalytics
│   ├── certificates/      # CertificateTemplate, CertificateConfig, Certificate, batches
│   ├── reports/           # ReportPreset, ReportColumn, ReportExport, ReportType
│   ├── documents/         # Document, GeneratedArtifact
│   └── notifications/     # NotificationTemplate, NotificationMessage, NotificationBatch
├── frontend/src/
│   ├── api/               # axios API modules + typed clients
│   ├── auth/              # AuthProvider / AuthContext
│   ├── components/        # shared UI (Btn, TextInput, TSelect, Stat, DataTable, …)
│   ├── hooks/             # useAuth (+ shared hooks)
│   ├── layouts/           # (admin) layout with collapsible sidebar + master-data subnav
│   ├── pages/             # route pages (Programs, ProgramDetail, Wizard,
│   │                      #   Participants, ParticipantDetail, MasterData, Notifications,
│   │                      #   public/: register, My QRs, feedback, …)
│   ├── types/             # shared TS types, MASTERS definitions
│   └── utils/             # non-component helpers (date, html, overlay, dynamicForm, …)
└── docs/                  # API contract, requirements/HLD, this reference
```

---

## 4. Django apps and models

All domain models inherit `AuditableModel` (timestamps + UUID pk via `core`) and,
where noted, `SoftDeleteModel` (rows hidden by default; soft-delete).

### `core`
`TimeStampedModel`, `UUIDModel`, `BaseModel`, `AuditableModel`,
`SoftDeleteModel`, `SoftDeleteManager`. Provides the base model mixins used by every app.

### `programs` (master data + programmes)
- **Master data** (all `MasterBase`, a thin `AuditableModel` of `code` + `name`):
  - `AcademicDepartment` — participant's home department (e.g. Department of Chemistry)
  - `AdministrativeDepartment` — internal admin units (e.g. IQAC)
  - `Designation` — participant job title (**`rank` removed** in the refactor)
  - `ProgramType` — FDP / Seminar / Workshop
  - `Venue` — programme location (e.g. Dr. A.K. Dorle Auditorium)
  - `QuestionType` — quiz question kinds
  - `FoodType` — per-day meal type
- `AcademicSession` — academic year/session (soft-delete)
- `Program` — the programme itself: title, short_code, type, dates, coordinator,
  status machine, registration settings, `registration_schema` (JSON), soft-delete
- `ProgramDay` — a day within a programme; has `resource_persons` as a **JSONField**
  (free-text list of `{name, designation, institution, email, phone}`) — replaced the old
  ResourcePerson M2M. Per-day service toggles (`attendance_enabled`, `food_enabled`,
  `quiz_enabled`, `other_enabled`) remain; **`feedback_enabled` was removed** — feedback
  is now a program-level concern (see `FeedbackInstance`) and is no longer gated per day
  (migration `programs/0010_remove_programday_feedback_enabled`).
- `ProgramServiceConfig` — flags per programme (attendance/food/feedback/quiz/other)
- `ProgramAssignment` — assignment of staff to a programme

**Removed in the refactor:** `ResourcePerson`, `ParticipantType`, `InstitutionType`,
`CertificateType` model classes; `Designation.rank`; `Program.resource_persons`
(M2M), `Program.target_participant_types` (M2M), `Program.certificate_template` (FK).

Program status values (`.value` returned to the frontend): `DRAFT`, `PUBLISHED`,
`REG_OPEN`, `REG_CLOSED`, `ONGOING`, `COMPLETED`, `ARCHIVED`, `CANCELLED`,
`POSTPONED`, `RESCHEDULED`. Legal transitions are enforced in
`programs/views.py` `ProgramStatusView.VALID_TRANSITIONS` (e.g. `DRAFT → PUBLISHED`,
`REG_OPEN → REG_CLOSED`, `COMPLETED → ARCHIVED`). `CANCELLED` has no outgoing
transition — recovering from it currently requires a direct DB update.

### `participants`
- `Participant` — person record (email, full_name, mobile, department/designation FKs,
  free-text institution/city/state, consent). **`participant_type` and
  `institution_type` FKs were removed** in the refactor.
- `Registration` — a participant's registration into a specific programme with status
  (approved / waitlist / etc.) and `registration_number`.
- `WaitlistPromotion` — waitlist → approved movement.
- Public registration view (`participants/views_public.py`) parses the programme's
  `registration_schema` to extract identity (email/mobile/full_name/institution), and
  only accepts POSTs when the programme status is `REG_OPEN`/`PUBLISHED` and the
  registration link is enabled.

### `attendance`
`AttendanceRecord`, `AttendanceSession`, `AttendanceGate` — session-based attendance
with gates, late marking, and per-day capture. **DB constraint:** a participant can have
at most one record per day (`unique_participant_day_attendance`, migration
`attendance/0003`), plus a composite index on `(source, marked_at)` for the live
attendance feed.

### `food`
`FoodService` (per-day food config/type), `FoodEligibility`, `FoodToken` (QR),
`FoodClaim`, `FoodSummary`. **DB constraints (migration `food/0002`):** one
`FoodEligibility` per `(service, participant)` (`unique_eligibility_token`),
and `FoodToken.token` is globally unique (`unique_food_token`).

### `feedback`
`FeedbackInstance`, `FeedbackResponse`, `FeedbackAnalytics`, plus quiz support.
Feedback is activated/collected at the **program level** — the per-day `feedback_enabled`
toggle no longer exists. The public endpoints return every `ACTIVE` instance linked to the
program (posting no longer rejects based on a "day").

### `certificates`
`CertificateTemplate` (the file/template for a programme's certificate),
`CertificateConfig`, `Certificate` (issued certificates; note the underlying table is
named `certificate_template` but is **not** related to the removed `CertificateType`),
`CertificateBatchJob`.

### `reports`
`ReportPreset`, `ReportColumn`, `ReportExport`, enum `ReportType`.

### `documents`
`Document`, `GeneratedArtifact`, enum `DocumentCategory`.

### `notifications`
`NotificationTemplate`, `NotificationMessage`, `NotificationBatch`,
enum `NotificationChannel`. **`participant_type` filtering support was removed** in the
refactor (notifications no longer filter by participant type).

---

## 5. Master data — current list

Master entities are exposed through a generic master-data endpoint
(`/api/v1/master-data/<category>/` on the backend, consumed via `listMasterDataCategory`
/ `listMasterActive`). The frontend `MASTERS` array in `frontend/src/types/index.ts`
currently contains:

| Category key            | Model                     | Notes                                   |
|-------------------------|---------------------------|-----------------------------------------|
| `academic-departments`  | `AcademicDepartment`      | used for participant department select  |
| `admin-departments`     | `AdministrativeDepartment`| internal admin units                    |
| `designations`          | `Designation`             | no `rank` field anymore                 |
| `program-types`         | `ProgramType`             | FDP / Seminar / Workshop                |
| `venues`                | `Venue`                   | programme location                      |
| `question-types`        | `QuestionType`            | quiz question kinds                     |
| `food-types`            | `FoodType`                | per-day meal type                       |

`resource-persons`, `participant-types`, `institution-types` and
`certificate-types` were removed from this list.

Master field definitions in `frontend/src/types/index.ts` support an optional
`table: true` flag — a field flagged this way is rendered as a table column; fields
without the flag are still capturable in the create/edit form but kept out of the list.
Masters with no flagged fields keep showing all fields. **Venues** uses this to show a
compact table (City, Capacity, Contact Person, Contact Phone, Is Online) instead of all
seven custom columns.

Resource persons are now typed **per programme day** (free text, JSON) in the
Program Wizard → "Days & Services" step, rather than selected from a global master.

---

## 6. Key API surfaces

All prefixed with `/api/v1`. Auth uses JWT (`djangorestframework-simplejwt`).

- `GET/POST/PATCH/DELETE /master-data/<category>/` — master CRUD
- `GET/POST /programs/`, `GET/PUT/PATCH /programs/<id>/`, `POST /programs/<id>/status/` —
  programmes + the status machine (`{to, reason}`)
- `/programs/days/` — programme days (`POST` accepts `resource_persons` JSON array)
- `GET/POST /participants/`, `GET /participants/<id>/`,
  `GET /participants/program/<program_id>/matrix/` — participants + status matrix
- `POST /public/p/<public_token>/register/` — public self-registration
- `GET /public/p/<public_token>/my-qrs/` — participant self-service: returns per-day
  **attendance QRs** for every enabled day (`attendance_qrs[]`) and a **food QR** only
  when that day is `food_enabled` and the `FoodService` is active
- Public feedback: lists every `ACTIVE` `FeedbackInstance` for the programme's public
  token (no per-day gating)
- Attendance, food, certificates, reports and notifications each expose
  their own REST sub-routes.
- `GET /api/v1/users/` — (staff) user rows for coordinator selection.

Full detail is in `docs/api/IQAC-PMS-API-Contract.md`.

---

## 7. Program registration form

`Program.registration_schema` is a JSON `{ "fields": [...] }` document. Each field has a
`name`, `type` (`text | longtext | email | phone | number | select | radio | checkbox |
date | yesno`), `label`, `options` (for selection types) and `required`.

Example (as saved for the "Campus to Community" programme, `CAMPUSTO`):

```json
{
  "fields": [
    { "name": "Full Name", "type": "text",  "label": "Full Name",   "options": [], "required": true },
    { "name": "Email",     "type": "email", "label": "Email",       "options": [], "required": true },
    { "name": "Contact No.", "type": "text","label": "Contact No.", "options": [], "required": true },
    { "name": "Gender",    "type": "radio", "label": "Gender",
      "options": ["Male", "Female", "Not Prefer to Say"], "required": true },
    { "name": "Date of Birth", "type": "date", "label": "Date of Birth", "options": [], "required": true },
    { "name": "Want to Participate", "type": "yesno", "label": "Want to Participate", "options": [], "required": true },
    { "name": "Department", "type": "select", "label": "Department",
      "options": ["Department of Chemistry", "Department of Electronics and Computer Science"], "required": true }
  ]
}
```

> Note: earlier versions of this schema stored malformed `Gender` options that
> included stray brackets (e.g. `"[Male`). These were corrected; check new/dynamic
> schemas for clean option strings.

---

## 8. Status machine reference

`Program.Status` values and legal transitions (`ProgramStatusView.VALID_TRANSITIONS`):

| From         | Can go to                                        |
|--------------|--------------------------------------------------|
| `DRAFT`      | `PUBLISHED`, `CANCELLED`                         |
| `PUBLISHED`  | `REG_OPEN`, `POSTPONED`, `CANCELLED`             |
| `REG_OPEN`   | `REG_CLOSED`, `CANCELLED`                        |
| `REG_CLOSED` | `ONGOING`, `POSTPONED`, `CANCELLED`              |
| `ONGOING`    | `COMPLETED`, `RESCHEDULED`                       |
| `POSTPONED`  | `RESCHEDULED`, `CANCELLED`                       |
| `RESCHEDULED`| `ONGOING`, `CANCELLED`                           |
| `COMPLETED`  | `ARCHIVED`                                       |
| `CANCELLED`  | *(none)*                                         |

---

## 9. Master-data refactor summary (Aug 2026)

Kept and verified:

- Frontend references to `participant_type` cleaned from
  `ParticipantsPage`, `ParticipantDetailPage`, the `Participant` / `StatusMatrixRow` /
  `ParticipantPayload` types and the participants API client.
- A per-day **Resource person** editor added to the Program Wizard's
  "Days & Services" step (`DayResourcePerson` type, `resource_persons` in the day
  save payload and the `ProgramDay` type).
- CAMPUSTO's saved `registration_schema` restored and its `Gender` option brackets
  cleaned.
- Backend restarted and serving the refactored code; `manage.py check` reports 0
  issues; `npm.cmd run build` passes.

Net effect: four empty master tables removed with zero data loss, resource persons are
now typed per programme day, and designations no longer carry a `rank` ordering.

---

## 10. Recent changes (Sept 2026 — production hardening + premium-ERP pass)

Verified state: `manage.py check` clean, `npm.cmd run build` green, `npm.cmd run lint`
0 errors (only `set-state-in-effect` warnings remain).

### Behaviour / fixes
- **Daywise feedback removed.** `feedback_enabled` dropped from `ProgramDay`
  (`programs/0010_remove_programday_feedback_enabled`); public feedback lists every
  `ACTIVE` `FeedbackInstance` for the program and no longer rejects on a disabled day.
- **My QRs is day-aware.** `GET …/my-qrs/` returns `attendance_qrs[]` (one QR per
  `attendance_enabled` day) and a food QR only when that day has an active
  `FoodService` with `food_enabled`. Verified live for CAMPUSTO (both days ON → 2
  attendance + 2 lunch QRs for `DEEKSHAR-0001`).
- **Venues table layout** — compact column set via the new `table` flag on master
  field definitions (`MasterFieldDef.table`).
- **Sidebar collapse** — `<<` / `>>` chevron inside the brand row; collapsed rail now
  applies at every viewport ≥ 768 px (previously the `max-width:1180px` guard kept
  wide desktops stuck expanded).

### Backend hardening
- **Security-first settings** (`config/settings.py`): required `SECRET_KEY`, `DEBUG`
  defaults `False`, `ALLOWED_HOSTS` from env, optional HTTPS headers/flags, and
  `PUBLIC_SITE_URL` / `FRONTEND_URL` / `CORS_ALLOWED_ORIGINS` centralized.
- **No hardcoded localhost** — notification links (`core/notifications.py`) and
  certificate verification URLs resolve through `settings.PUBLIC_SITE_URL`.
- **OpenAPI completeness** — explicit request/response serializers + `@extend_schema`
  on the attendance views (admin + public, incl. self-checkin + scan) and
  `@extend_schema_field` type hints on every `SerializerMethodField` across `core`,
  `feedback`, `food`, `participants`, `programs`.
- **DB constraints** — see §4 (`attendance/0003`, `food/0002`), applied live.

### Frontend architecture
- `ErrorBoundary` wraps all routes (`components/ErrorBoundary.tsx`).
- Cancellable axios requests (`api/client.ts` → `cancellableRequest()` /
  `createCancelToken()`).
- Fast-Refresh hygiene: all non-component exports moved to `utils/html.ts`,
  `utils/date.ts`, `utils/formSchema.ts`, `utils/dynamicForm.ts`, `utils/overlay.ts`,
  `utils/auth.ts` and `hooks/useAuth.ts`; component files now export components only
  (fixed the oxlint `only-export-components` set).
- CountUp hook dependency fixed (`components/common.tsx`, `hasMatch` dep).
