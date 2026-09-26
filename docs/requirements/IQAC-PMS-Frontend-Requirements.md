# IQAC Program Management System — Frontend Requirements

> **IQAC PMS** — Internal Quality Assurance Cell · Programme Management System
> Version: **1.0** (Sept 2026) · Roles: **SA / PA / PC / AO / FO / V**
> URLs — Admin console: `http://localhost:5173` · API: `http://localhost:8000/api/v1`
> OpenAPI: `http://localhost:8000/api/docs/` (Swagger) / `http://localhost:8000/api/redoc/`
> Admin login: `admin@university.edu` / `Admin@12345`
> Full project reference: `docs/PROJECT-REFERENCE.md`

**Version:** 0.1 (Draft for review) · **Date:** 25 August 2026 · **Status:** Draft — pending discussion

**Related documents:** `IQAC-PMS-Requirements-and-HLD.md` (master spec — source of truth for business rules and functional requirement IDs), `IQAC-PMS-Backend-Requirements.md` (the API this frontend consumes), `IQAC-PMS-API-Contract.md` (the exact request/response seam between the two).

---

## 1. Purpose and the frontend/backend seam

This document specifies **only** the client-side application(s). The frontend renders the user interface and calls the backend over HTTP/JSON; it holds no business logic and no secrets. The backend is the single source of truth for every rule, value, and permission.

The contract between the two is deliberately narrow so each side can change independently:

- The frontend **may assume**: the backend validates everything, enforces every permission, generates every token/QR, and computes every status. The frontend renders results and collects input.
- The frontend **must never**: decide eligibility, trust its own validation as authoritative, embed secrets/keys, or read the database directly.
- The only coupling point is the **API contract**. If an endpoint's shape doesn't change, the UI can be rewritten freely; if the UI's needs don't change, backend internals can be rewritten freely.

## 2. Guiding principles

- **Config-driven rendering.** Forms, program days, enabled services, report columns, and certificate previews are all drawn from configuration the backend sends. Adding a registration field or a program day must never require a frontend code change (mirrors the master spec's configuration-driven principle).
- **Server is authoritative.** Client-side validation and role-based hiding exist for speed and clarity only; the backend re-checks and can reject.
- **Mobile-first where it counts.** Attendance and food-claim scanning happen on phones at counters and doors. Those flows are designed for small screens, one hand, poor network, and speed.
- **Fail loud, fail clear.** Every action has explicit loading, success, empty, and error states. Scanning in particular gives unmistakable accept / reject feedback.
- **Accessible and resilient.** Public pages must work on modest devices and degrade gracefully.

## 3. Application structure

Two frontends share one component library and one API client:

| App | Users | Rendering | Auth |
|---|---|---|---|
| **Public Web** | Participants, and staff opening scan links | Server-rendered pages (fast first paint, link-friendly) | None — scoped by opaque token in the URL |
| **Admin Console** | SA, PA, PC, AO, FO, V (see master §12) | Single-page app | Authenticated session (JWT), RBAC-gated |

Rationale: public pages are opened from links/QRs by people who never log in, so they must be fast and shareable; the admin console is a rich, stateful tool for staff. Splitting them keeps the public bundle tiny and the admin bundle feature-rich, and lets either be redeployed alone.

## 4. Cross-cutting concerns

- **FE-X-01 API client layer.** All network calls go through one typed client that attaches auth, applies the standard error envelope, handles retries/timeouts, and centralizes the base URL and API version. No component calls `fetch` directly.
- **FE-X-02 Auth & session (admin).** Store the access token in memory; refresh silently; on 401 route to login preserving the return path. Never persist tokens in `localStorage`.
- **FE-X-03 RBAC-based UI gating.** Hide or disable controls the current role can't use, driven by the permissions the backend returns for the session — but treat this as cosmetic; the backend enforces. New roles/permissions must not require hard-coded UI conditionals beyond reading the permission flags.
- **FE-X-04 Universal states.** Every data view implements loading, empty, error, and success states; every mutating action implements pending/disabled, success toast, and inline error.
- **FE-X-05 Responsive & theming.** Defined breakpoints; a single theme layer (colors, logo, institute name) so branding is config, not code.
- **FE-X-06 Accessibility.** Keyboard navigation, labels/ARIA on form controls, sufficient contrast, focus management on route change.
- **FE-X-07 Internationalization-ready.** All copy through a string layer so a second language can be added without touching components.
- **FE-X-08 Client validation mirror.** Render and enforce (for UX) the validation rules the backend sends with each form schema; always surface backend rejection messages verbatim.

## 5. Module requirements

Each module lists its **responsibility** (high level) followed by specific requirements. IDs use `FE-<AREA>-NN`. The **Traces to** note links back to master-spec functional IDs.

### 5.1 Public — Registration (`FE-REG`) · Traces to FR-LINK, FR-FORM, FR-REG

Responsibility: render a program's public registration page from its link token and submit a registration.

- **FE-REG-01** Resolve the program from the URL token; show program title, description, dates, and open/closed state.
- **FE-REG-02** Render the registration form dynamically from the backend form schema (see 5.9); no field is hard-coded.
- **FE-REG-03** Show inline validation from the schema; on submit, show backend validation/duplicate errors against the right fields.
- **FE-REG-04** Handle closed/full/expired links with a clear message (no form).
- **FE-REG-05** On success, show a confirmation screen (and note that a confirmation/link may be emailed); never expose internal IDs or tokens of others.

### 5.2 Public — Feedback (`FE-FB`) · Traces to FR-FORM, FR-FB

Responsibility: render and submit the feedback form for a program (or a specific day).

- **FE-FB-01** Resolve context from token; render feedback form dynamically (same renderer as registration).
- **FE-FB-02** If already submitted (backend says so), show "already recorded" rather than a blank form.
- **FE-FB-03** Confirmation state on success.

### 5.3 Public — Scan result pages (`FE-SCAN`) · Traces to FR-ATT, FR-FOOD

Responsibility: the page an operator lands on / the result surface when a QR is scanned (attendance or food claim). See 5.13 for the scanning UI itself.

- **FE-SCAN-01** Render an unambiguous result: **Accepted**, **Already claimed / already marked**, **Not eligible**, or **Invalid/expired** — each with distinct color, icon, and text.
- **FE-SCAN-02** Show only what the operator needs (e.g., participant name/photo if provided, service name, day) — no bulk PII.
- **FE-SCAN-03** Provide an obvious "scan next" affordance for high-throughput counters.

### 5.4 Public — Certificate (`FE-CERT`) · Traces to FR-CERT

Responsibility: let a participant download their certificate and let anyone verify one.

- **FE-CERT-01** Token-based certificate retrieval/download (PDF) when eligible and issued.
- **FE-CERT-02** Public verification page: given a certificate number/token, show **Valid**, **Cancelled**, or **Not found** with issuing details, no other PII.

### 5.5 Admin — Authentication (`FE-AUTH`) · Traces to FR-AUD, backend auth

- **FE-AUTH-01** Login (email + password), optional 2FA (TOTP) step, error handling, and logout.
- **FE-AUTH-02** Respect session expiry/refresh transparently; deep-link return after login.

### 5.6 Admin — Dashboard (`FE-DASH`) · Traces to FR-DASH

- **FE-DASH-01** Session/program overview cards (counts of programs by status, upcoming days, pending actions).
- **FE-DASH-02** Per-program quick stats: registrations, attendance rate, food claimed vs eligible, feedback response rate, certificates issued — all read from backend analytics endpoints.

### 5.7 Admin — Academic sessions & master data (`FE-SES`, `FE-MD`) · Traces to FR-SES, FR-MD

- **FE-SES-01** CRUD academic sessions; mark active; guard against deleting sessions with programs.
- **FE-MD-01** Manage master data (departments, program types, service types, certificate templates, etc.) as configurable lists that feed the wizard's dropdowns.

### 5.8 Admin — Program wizard & day configuration (`FE-WIZ`, `FE-DAY`) · Traces to FR-PROG, FR-WIZ, FR-DAY

Responsibility: create and configure a program end-to-end without code.

- **FE-WIZ-01** Multi-step wizard: basics → schedule/days → services per day → registration form builder → feedback form builder → certificate config → review. Steps are resumable (draft saved server-side).
- **FE-WIZ-02** Each step validates before advancing; review step summarizes all config before publish.
- **FE-DAY-01** Per-day configuration UI: toggle which services (attendance, food, etc.) apply to each day; set eligibility parameters where relevant. Number of days is data-driven.
- **FE-WIZ-03** Form builder (registration & feedback): add/reorder/remove fields, choose field type, mark required, set options/validation — producing the schema the public renderer consumes. This is the heart of "configuration-driven."

### 5.9 The dynamic form renderer (`FE-FORM`) · Traces to FR-FORM

Responsibility: one shared component that renders any form from a backend schema. Used by registration, feedback, and previewed in the builder.

- **FE-FORM-01** Support the full field-type set defined by the backend (e.g., text, email, phone, number, single/multi-select, date, boolean, section headings) — driven by the schema, extensible without UI edits.
- **FE-FORM-02** Apply per-field validation (required, pattern, min/max, options) from the schema; show messages inline.
- **FE-FORM-03** Support conditional visibility if the schema defines it.
- **FE-FORM-04** Never assume a fixed field set; unknown-but-declared types render via a registry so adding a type is additive.

### 5.10 Admin — Link management (`FE-LINK`) · Traces to FR-LINK

- **FE-LINK-01** View/generate/regenerate the public registration link and its QR; copy/share; show open/closed status and any capacity/expiry.

### 5.11 Admin — Participant management & status matrix (`FE-PART`, `FE-MTX`) · Traces to FR-PART, FR-MTX

- **FE-PART-01** Participant list with server-side search, filter, sort, and pagination.
- **FE-PART-02** Participant detail: registration data, per-day attendance, food eligibility/claim state, feedback state, certificate state.
- **FE-MTX-01** Status-matrix view showing, per participant, the separated statuses (Attendance / Eligibility / QR generated / QR sent / Claimed / Feedback / Certificate) so operators can see exactly where each person is. Read-only reflection of backend truth.
- **FE-PART-03** Manual actions where permitted (e.g., manual attendance, override eligibility) with confirmation and audit note; visibility gated by role.

### 5.12 Admin — Attendance (`FE-ATT`) · Traces to FR-ATT

- **FE-ATT-01** Choose program + day, then capture attendance by scanning (5.13) or manual check-off/search.
- **FE-ATT-02** Live running count and duplicate-safe feedback (marking twice is a no-op with clear messaging).

### 5.13 QR scanning experience (`FE-QR`) · Traces to FR-ATT, FR-FOOD

Responsibility: the shared camera-based scanner used for attendance and food claims. This is the most performance- and UX-sensitive surface.

- **FE-QR-01** Camera access with permission prompt and fallback to manual code entry.
- **FE-QR-02** Continuous scan mode: decode, submit to backend, show result, auto-ready for the next — optimized for a queue.
- **FE-QR-03** Distinct, instant feedback per outcome (accepted / duplicate / not eligible / invalid), reinforced with color, icon, and optional sound + vibration.
- **FE-QR-04** Resilient to slow/dropped network: show pending state, prevent double-submit of the same code, reconcile on response; never grant/deny locally.
- **FE-QR-05** Never trust the scan client-side — the backend performs the atomic single-use check; the UI only reflects its verdict.

### 5.14 Admin — Food management (`FE-FOOD`) · Traces to FR-FOOD

Responsibility: operate the attendance-based food flow.

- **FE-FOOD-01** Eligibility view per day/service: who is eligible (with the rule shown), who has a QR generated, sent, and claimed — using the separated statuses.
- **FE-FOOD-02** "Generate QR for eligible" and, critically, **"Send to newly eligible only"** actions, each with a confirmation showing the count that *will* be affected, and a result summary. The frontend calls one idempotent endpoint; it does not compute the delta.
- **FE-FOOD-03** Claim scanning via the shared scanner (5.13); live claimed/remaining counts.
- **FE-FOOD-04** Guard against accidental re-send: the UI communicates that re-running "send new" will not re-notify already-sent participants.

### 5.15 Admin — Feedback management (`FE-FBM`) · Traces to FR-FB

- **FE-FBM-01** Configure/enable feedback (program-level or per day); view response rate.
- **FE-FBM-02** Analytics view: counts, averages, distributions, and free-text comments, rendered from backend aggregates.

### 5.16 Admin — Certificate management (`FE-CERTM`) · Traces to FR-CERT

- **FE-CERTM-01** Configure certificate template/fields and eligibility rule for the program.
- **FE-CERTM-02** Preview a sample certificate; view the computed eligible list with the ability to adjust/override (audited).
- **FE-CERTM-03** Trigger generation and sending; show progress and per-participant status (a long-running job — reflect backend job state).

### 5.17 Admin — Documentation (`FE-DOC`) · Traces to FR-DOC

- **FE-DOC-01** Upload/list/replace supporting documents for a program, with type and description; show who uploaded and when.

### 5.18 Admin — Reports builder (`FE-RPT`) · Traces to FR-RPT

Responsibility: configurable, filterable exports.

- **FE-RPT-01** Choose report scope (program/session), select **which columns** to include from the backend-provided available-column list, and apply filters — nothing hard-coded.
- **FE-RPT-02** Trigger export (Excel); show generation progress and provide the download when ready.
- **FE-RPT-03** Preview a sample/first rows before exporting where feasible.

### 5.19 Admin — Program closure (`FE-CLO`) · Traces to FR-CLO

- **FE-CLO-01** Closure checklist UI reflecting backend readiness (registration closed, attendance finalized, food finalized, feedback closed, certificates handled, docs uploaded), each with status and blockers.
- **FE-CLO-02** Trigger closure only when the backend reports all gates satisfied; show the generated program report and switch the program to read-only/archived view.

### 5.20 Admin — User & role management (`FE-USR`) · Traces to master §12

- **FE-USR-01** Manage users and role assignments (SA scope); scope assignments for PC/AO/FO to specific programs where applicable.

### 5.21 Admin — Audit log viewer (`FE-AUD`) · Traces to FR-AUD

- **FE-AUD-01** Searchable, filterable, read-only audit trail (actor, action, entity, timestamp) surfaced from the backend.

## 6. Non-functional requirements (frontend)

- **FE-NFR-01 Performance.** Public pages fast on mid-range phones; scanning result round-trip feels instant (optimistic UI where safe, but never for the authoritative verdict).
- **FE-NFR-02 Compatibility.** Recent evergreen browsers; graceful messaging on unsupported ones.
- **FE-NFR-03 Accessibility.** Meet WCAG AA on public pages.
- **FE-NFR-04 Resilience.** Handle flaky networks on scan/claim flows without producing incorrect local decisions.
- **FE-NFR-05 Security.** No secrets in the client; tokens only in memory; render only the PII the backend returns for the current role/scope.
- **FE-NFR-06 Maintainability.** Shared component library + typed API client; module boundaries mirror this document so a change to one module doesn't ripple.

## 7. Recommended frontend technology

- **Framework:** Next.js (React) — SSR for public pages, SPA for admin, one codebase or a shared component package.
- **Language:** TypeScript (types generated from the API contract keep FE/BE in lockstep).
- **Styling:** a utility CSS framework (e.g., Tailwind) + a small themeable design-token layer.
- **Data layer:** a typed API client with a query/cache library (e.g., TanStack Query) for server state; minimal global client state.
- **QR:** a browser QR-decoding library for the camera scanner; QR *images* are produced by the backend.
- **Forms:** a schema-driven form library feeding the dynamic renderer.

## 8. Traceability summary

Every master-spec module has a frontend home: FR-SES→5.7, FR-MD→5.7, FR-PROG/FR-WIZ→5.8, FR-DAY→5.8, FR-LINK→5.10, FR-FORM→5.9, FR-REG→5.1, FR-PART→5.11, FR-ATT→5.12/5.13, FR-FOOD→5.14, FR-FB→5.2/5.15, FR-MTX→5.11, FR-CERT→5.4/5.16, FR-DOC→5.17, FR-RPT→5.18, FR-DASH→5.6, FR-CLO→5.19, FR-AUD→5.21.

**FR-NOT (notifications)** has no dedicated frontend module by design — sending is a backend/worker concern (Backend §5.14). The frontend only *triggers* notifications indirectly (e.g., "Send to newly eligible" in 5.14, certificate send in 5.16) and *reflects* delivery status; it composes no messages itself. Anything the UI cannot do alone is delegated to the backend via the API contract.
