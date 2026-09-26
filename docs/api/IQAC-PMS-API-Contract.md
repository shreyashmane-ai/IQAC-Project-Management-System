# IQAC Program Management System — API Contract

> **IQAC PMS** — Internal Quality Assurance Cell · Programme Management System
> Version: **1.0** (Sept 2026) · Roles: **SA / PA / PC / AO / FO / V**
> URLs — Admin console: `http://localhost:5173` · API: `http://localhost:8000/api/v1`
> OpenAPI: `http://localhost:8000/api/docs/` (Swagger) / `http://localhost:8000/api/redoc/`
> Admin login: `admin@university.edu` / `Admin@12345`
> Full project reference: `docs/PROJECT-REFERENCE.md`

**Version:** 0.1 (Draft for review) · **Date:** 25 August 2026 · **Status:** Draft — pending discussion

**Related documents:** `IQAC-PMS-Requirements-and-HLD.md` (master spec), `IQAC-PMS-Frontend-Requirements.md` (consumer), `IQAC-PMS-Backend-Requirements.md` (provider).

This is the **seam** between frontend and backend. Both sides build against it. As long as this contract holds, either side can be rewritten independently. Endpoint shapes below are indicative sketches (not final JSON schemas) meant to pin down structure, auth, and behavior; the authoritative machine-readable spec will be an OpenAPI document generated from the backend.

---

## 1. Conventions

- **Base URL & version:** `/api/v1`. Breaking changes bump the version (`/api/v2`); additive changes don't.
- **Format:** JSON request/response, UTF-8. Timestamps ISO-8601 UTC.
- **Two auth planes:**
  - **Admin plane** — staff endpoints require `Authorization: Bearer <access-token>` (JWT). RBAC enforced server-side.
  - **Public plane** — participant/operator endpoints are authenticated **only** by an opaque token in the path/body (from a link or QR). No login, no cookies. Tokens are ≥128-bit, carry no PII, and are scoped (registration / feedback / attendance / food / verify).
- **Pagination:** list endpoints accept `?page` & `?pageSize` (or cursor) and return `{ data: [...], page, pageSize, total }`.
- **Filtering/sorting:** `?filter[field]=value`, `?sort=field|-field`, `?q=` for search — the backend defines allowed fields per resource.
- **Idempotency:** effectful POSTs (claims, sends, generation) accept an `Idempotency-Key` header; repeating a key returns the original result.
- **Errors:** consistent envelope (see §3).

## 2. Auth model summary

| Plane | Credential | Used by | Example endpoints |
|---|---|---|---|
| Admin | Bearer JWT (+ optional 2FA at login) | SA/PA/PC/AO/FO/V | everything under §5.2–§5.16 |
| Public | Opaque scoped token in URL/body | Participants, scanning operators | §5.17 |

RBAC: each admin endpoint declares the roles allowed; program-scoped roles (PC/AO/FO) are further limited to assigned programs. Unauthorized → `403`.

## 3. Standard error envelope

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable summary.",
    "fieldErrors": { "email": "Already registered for this program." }
  }
}
```

Common codes: `VALIDATION_ERROR` (422), `UNAUTHENTICATED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `CONFLICT` (409 — duplicate registration, already-claimed, capacity full), `RATE_LIMITED` (429), `SERVER_ERROR` (500). The frontend renders `fieldErrors` inline and `message` as a toast.

## 4. Conventions for the tables below

Each endpoint shows **method + path**, **auth** (admin role(s) or public token scope), **purpose**, and notable request/response notes. `{id}`/`{token}` are path params.

## 5. Endpoints

### 5.1 Auth (`BE-AUTH`)

| Method & path | Auth | Purpose / notes |
|---|---|---|
| `POST /auth/login` | public | `{email,password}` → `{accessToken,refreshToken}` or a `2FA_REQUIRED` challenge. |
| `POST /auth/2fa` | public (challenge) | `{challengeId,code}` → tokens. |
| `POST /auth/refresh` | refresh token | → new access token. |
| `POST /auth/logout` | admin | revoke session. |
| `POST /auth/password/reset-request` / `POST /auth/password/reset` | public | email-based reset flow. |
| `GET /me` | admin | current user + **effective permissions** + program scopes (frontend uses this for UI gating). |

### 5.2 Users & roles (`BE-USR`, SA)

| Method & path | Auth | Purpose |
|---|---|---|
| `GET /users` · `POST /users` · `GET/PATCH/DELETE /users/{id}` | SA | manage staff accounts. |
| `POST /users/{id}/roles` | SA | assign role + program scope. |

### 5.3 Academic sessions (`BE-SES`)

| Method & path | Auth | Purpose |
|---|---|---|
| `GET /sessions` · `POST /sessions` · `GET/PATCH/DELETE /sessions/{id}` | SA/PA | CRUD; delete blocked if programs exist. |
| `POST /sessions/{id}/activate` | SA/PA | set active. |
| `GET /sessions/{id}/analysis` | SA/PA/V | annual aggregation. |

### 5.4 Master data (`BE-MD`)

| Method & path | Auth | Purpose |
|---|---|---|
| `GET/POST/PATCH/DELETE /master/{type}` | SA/PA | configurable lists (departments, program-types, service-types, cert-templates, field-type catalog). `{type}` is data-driven. |

### 5.5 Programs & wizard (`BE-PROG`, `BE-WIZ`)

| Method & path | Auth | Purpose |
|---|---|---|
| `GET /programs` | SA/PA/PC/V | list/filter (scope-aware). |
| `POST /programs` | SA/PA/PC | create draft. |
| `GET /programs/{id}` | scoped | full config aggregate. |
| `PATCH /programs/{id}` | SA/PA/PC | update any config step (basics, schedule, etc.); supports partial/step saves for wizard resume. |
| `POST /programs/{id}/status` | SA/PA/PC | `{to:"published"|"registration_open"|...}` — validated transition; illegal → `409`. |
| `DELETE /programs/{id}` | SA/PA | only from Draft. |

### 5.6 Program days & services (`BE-DAY`)

| Method & path | Auth | Purpose |
|---|---|---|
| `GET /programs/{id}/days` · `PUT /programs/{id}/days` | scoped | read/replace the day list (N days, data-driven). |
| `PUT /programs/{id}/days/{dayId}/services` | scoped | per-day service toggles + params (e.g., food threshold). |

### 5.7 Form schemas (`BE-FORM`)

| Method & path | Auth | Purpose |
|---|---|---|
| `GET /programs/{id}/forms/registration` · `PUT ...` | scoped | read/update the registration schema (fields, types, validation, conditional rules). |
| `GET /programs/{id}/forms/feedback` · `PUT ...` | scoped | feedback schema (program-level or per-day scope). |
| `GET /master/field-types` | admin | the renderable field-type catalog (frontend renderer registry mirrors this). |

### 5.8 Links (`BE-LINK`)

| Method & path | Auth | Purpose |
|---|---|---|
| `GET /programs/{id}/link` | scoped | current public token, URL, QR image, open/closed, capacity. |
| `POST /programs/{id}/link/regenerate` | SA/PA/PC | rotate token (old link invalidated; audited). |
| `POST /programs/{id}/link/state` | scoped | open/close registration. |

### 5.9 Participants & status matrix (`BE-PART`, `BE-MTX`)

| Method & path | Auth | Purpose |
|---|---|---|
| `GET /programs/{id}/participants` | scoped | list with filter/search/sort/pagination. |
| `GET /participants/{pid}` | scoped | full per-participant state (registration + attendance + food + feedback + certificate). |
| `GET /programs/{id}/matrix` | scoped | the status matrix (separated statuses per participant). |
| `POST /participants/{pid}/overrides` | SA/PA/PC | audited manual override (attendance/eligibility). |

### 5.10 Attendance (`BE-ATT`)

| Method & path | Auth | Purpose |
|---|---|---|
| `POST /programs/{id}/days/{dayId}/attendance` | AO/PC/PA | `{participantRef}` or scanned token; **idempotent** — returns `{result:"marked"|"already_marked"}`. |
| `GET /programs/{id}/days/{dayId}/attendance` | scoped | roster + live count. |

### 5.11 Food (`BE-FOOD`) — concurrency-critical

| Method & path | Auth | Purpose / notes |
|---|---|---|
| `GET /programs/{id}/days/{dayId}/food/eligibility` | FO/PC/PA | eligible list with rule + per-person state (generated/sent/claimed). |
| `POST /programs/{id}/days/{dayId}/food/generate` | FO/PC/PA | generate QRs for eligible (idempotent per participant). |
| `POST /programs/{id}/days/{dayId}/food/send-new` | FO/PC/PA | **send to newly eligible only** — idempotent; returns `{sent:N, skippedAlreadySent:M}`. Lock-guarded; safe to retry. |
| `POST /programs/{id}/days/{dayId}/food/claim` | FO | claim scan `{token}` → atomic compare-and-set; `{result:"claimed"}` (200) or `CONFLICT already_claimed` (409) or `FORBIDDEN not_eligible`. |
| `GET /programs/{id}/days/{dayId}/food/summary` | scoped | claimed vs sent vs eligible counts. |

### 5.12 Feedback admin (`BE-FB`)

| Method & path | Auth | Purpose |
|---|---|---|
| `GET /programs/{id}/feedback/summary` | scoped | response rate + aggregates. |
| `GET /programs/{id}/feedback/analytics` | scoped | distributions, averages, comments. |

### 5.13 Certificates (`BE-CERT`)

| Method & path | Auth | Purpose |
|---|---|---|
| `GET/PUT /programs/{id}/certificate/config` | SA/PA/PC | template + eligibility rule. |
| `GET /programs/{id}/certificate/eligible` | scoped | computed eligible list (adjustable). |
| `POST /programs/{id}/certificate/generate` | SA/PA/PC | async batch → returns `{jobId}`. |
| `POST /programs/{id}/certificate/send` | SA/PA/PC | async send → `{jobId}`. |
| `GET /jobs/{jobId}` | admin | job status/progress (used for cert & report jobs). |

### 5.14 Documents (`BE-DOC`)

| Method & path | Auth | Purpose |
|---|---|---|
| `GET /programs/{id}/documents` · `POST /programs/{id}/documents` (multipart) · `DELETE /documents/{docId}` | scoped | supporting docs with metadata; access-controlled links. |

### 5.15 Reports (`BE-RPT`)

| Method & path | Auth | Purpose |
|---|---|---|
| `GET /reports/columns?type=...` | scoped | **available-columns catalog** for the chosen report type (drives column selection). |
| `POST /reports/export` | scoped | `{type, scope, columns:[...], filters:{...}, format:"xlsx"}` → `{jobId}`; poll `GET /jobs/{jobId}` for the download link. |

### 5.16 Dashboard & closure (`BE-DASH`, `BE-CLO`, `BE-AUD`)

| Method & path | Auth | Purpose |
|---|---|---|
| `GET /programs/{id}/dashboard` · `GET /sessions/{id}/dashboard` | scoped | aggregated metrics. |
| `GET /programs/{id}/closure/readiness` | scoped | gate checklist + blockers. |
| `POST /programs/{id}/closure/close` | SA/PA/PC | close if gates satisfied → finalizes stats, generates report, archives. |
| `GET /audit` | SA/PA | filterable, read-only audit trail. |

### 5.17 Public plane (token-scoped, no login) (`FR-LINK/REG/FORM/FB/ATT/FOOD/CERT`)

| Method & path | Token scope | Purpose |
|---|---|---|
| `GET /p/{token}` | registration | resolve program for the public registration page (title, dates, open/closed) + registration schema. |
| `POST /p/{token}/register` | registration | submit registration; validated against schema; dup → `409`; full → `409`. |
| `GET /p/{token}/feedback` | feedback | feedback schema + already-submitted flag. |
| `POST /p/{token}/feedback` | feedback | submit feedback; duplicate → short-circuit. |
| `POST /scan/attendance` | attendance | `{token}` scanned QR → mark attendance (idempotent). |
| `POST /scan/food` | food | `{token}` scanned QR → atomic single-use claim. |
| `GET /certificates/{token}` | verify/download | participant certificate download (PDF) when issued. |
| `GET /verify/{number}` | public | verification → `{status:"valid"|"cancelled"|"not_found", issuedTo?, program?, date?}`. |

> Note: the two scan endpoints are the highest-traffic, highest-contention calls. They return fast, unambiguous verdicts and are safe to retry; correctness is guaranteed server-side (Backend §6), never by the client.

## 6. Critical flows as endpoint sequences

These show how the seam is used end-to-end, so both teams share the same mental model.

**Registration:** `GET /p/{token}` → render form from schema → `POST /p/{token}/register` → `201` (or `409` duplicate/full) → confirmation.

**Attendance:** operator opens scanner → per person `POST /scan/attendance {token}` → `{marked | already_marked}` → live count from `GET .../attendance`.

**Food (the core loop):** `GET .../food/eligibility` (review) → `POST .../food/generate` → `POST .../food/send-new` (`{sent, skippedAlreadySent}`, re-runnable) → at the counter `POST /scan/food {token}` → `claimed` once, `already_claimed` thereafter → `GET .../food/summary`.

**Certificates:** `PUT .../certificate/config` → `GET .../certificate/eligible` (adjust) → `POST .../certificate/generate` → poll `GET /jobs/{jobId}` → `POST .../certificate/send` → public `GET /verify/{number}`.

**Reports:** `GET /reports/columns?type=...` → user picks columns/filters → `POST /reports/export` → poll `GET /jobs/{jobId}` → download.

**Closure:** `GET .../closure/readiness` → resolve blockers → `POST .../closure/close` → archived, report available.

## 7. Versioning & compatibility policy

- Additive changes (new endpoints, new optional fields) are backward-compatible and don't bump the version.
- Breaking changes (removing/renaming fields, changing semantics) require `/api/v2` and a deprecation window.
- The frontend pins the API version it targets; generated TypeScript types from the OpenAPI spec keep both sides in sync and surface breakage at build time.

## 8. Traceability

Every frontend action (Frontend §5) maps to one or more endpoints here, and every endpoint is owned by a backend module (Backend §5). If a needed capability has no endpoint, that is a contract gap to resolve before building — not something the frontend may work around locally.
