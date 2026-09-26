# IQAC Program Management System — Backend Requirements

**Version:** 0.1 (Draft for review) · **Date:** 25 August 2026 · **Status:** Draft — pending discussion

**Related documents:** `IQAC-PMS-Requirements-and-HLD.md` (master spec — source of truth), `IQAC-PMS-Frontend-Requirements.md` (the client this API serves), `IQAC-PMS-API-Contract.md` (the exact endpoint seam).

---

## 1. Purpose and the frontend/backend seam

This document specifies the **backend**: a headless API plus its workers and data store. The backend owns all business logic, data, security, and long-running work. The frontend only renders and collects input.

The backend's obligations to the frontend:

- **Be authoritative.** Validate every input, enforce every permission, compute every status, and generate every token/QR/PDF — regardless of what the client claims.
- **Be config-driven.** Programs, days, services, form schemas, report columns, and certificate templates are data, not code. A new field or day is a configuration row, never a deployment.
- **Be safe under concurrency.** Registration duplicates, food claims, and bulk sends must be correct when many requests arrive at once.
- **Be idempotent where it matters.** Retries (network hiccups, double taps, re-runs of "send new") must not double-charge effects.
- **Be auditable.** Every state-changing action is attributable and logged.

Everything the frontend needs is exposed through the versioned API contract; backend internals are otherwise free to change.

## 2. Guiding principles

- **Single source of truth.** The database + service layer decide reality; clients reflect it.
- **Configuration over code.** The dynamic form engine, per-day service toggles, eligibility parameters, report column catalog, and certificate templates are stored config.
- **Security by default.** Deny unless explicitly permitted; opaque high-entropy tokens; no PII in tokens/QRs/URLs.
- **Correctness under concurrency.** Enforce invariants in the database (unique constraints, transactions), not just in application code.
- **Separation of statuses.** Attendance, eligibility, QR-generated, QR-sent, and claimed are distinct states, never conflated (master spec BR set).
- **Everything auditable and reversible where sensible.**

## 3. Architecture (layers and modules)

Layered within the API service:

1. **API layer** — HTTP controllers: routing, auth guards, request validation (shape), serialization, error envelope. No business logic.
2. **Service/domain layer** — business rules, invariants, transactions, orchestration of workers. The heart of the system.
3. **Data-access layer** — repositories/ORM over PostgreSQL; owns queries, constraints, migrations.
4. **Workers** — background processors (queue-driven) for bulk email, QR/PDF generation, report building, and other long tasks.
5. **Integrations** — email/WhatsApp providers, object storage, all behind interfaces so providers can be swapped.

Domain modules mirror the frontend and master spec so responsibilities line up 1:1 (see §5).

## 4. Cross-cutting concerns

- **BE-X-01 AuthN.** Local accounts: argon2 password hashing, optional TOTP 2FA, short-lived access tokens + refresh, session revocation. Designed behind an auth-provider interface so university SSO/LDAP can be added later without touching business logic.
- **BE-X-02 AuthZ (RBAC).** Roles SA, PA, PC, AO, FO, V (master §12). Enforce at the service layer, scoped to program where applicable (PC/AO/FO). Expose the current user's effective permissions for the frontend to gate UI (cosmetically).
- **BE-X-03 Opaque tokens.** All public actions (registration link, feedback, attendance QR, food QR, certificate/verify) use unguessable ≥128-bit tokens. Tokens carry no PII, are validated server-side, and map to a scope + subject internally.
- **BE-X-04 Input validation.** Two layers: structural (shape/type at API layer) and semantic (business rules at service layer, including dynamic-form schema validation). Client validation is never trusted.
- **BE-X-05 Error model.** One consistent error envelope (code, message, field errors) so the frontend renders uniformly. Distinguish validation, auth, not-found, conflict (duplicate/already-claimed), and server errors.
- **BE-X-06 Idempotency.** Support idempotency keys on effectful POSTs (claims, sends) so retries are safe; "send to newly eligible" is inherently idempotent by design (see §6).
- **BE-X-07 Transactions.** Any multi-write invariant (registration + dedup, claim + status, closure gates) runs in a transaction.
- **BE-X-08 Audit log.** Append-only record of actor, action, entity, before/after where useful, timestamp — for every state change.
- **BE-X-09 Configuration.** Environment/config for providers, limits, token entropy, and feature toggles; no secrets in code.
- **BE-X-10 Observability.** Structured logs, health checks, and job/queue metrics.

## 5. Module requirements

Each module lists its **responsibility**, then rules/operations. IDs use `BE-<AREA>-NN`; **Traces to** links master-spec functional IDs.

### 5.1 Auth & Users (`BE-AUTH`, `BE-USR`) · Traces to master §12, FR-AUD

- **BE-AUTH-01** Register/manage staff accounts (SA); login, refresh, logout, password reset, optional 2FA.
- **BE-USR-01** Assign roles and program scopes; enforce least privilege. Changing roles is audited.
- **BE-AUTH-02** Rate-limit and lock out on repeated failed logins.

### 5.2 Academic Sessions (`BE-SES`) · Traces to FR-SES

- **BE-SES-01** CRUD sessions; exactly-one/active handling; prevent destructive changes when programs exist.
- **BE-SES-02** Provide session-level aggregation for annual analysis.

### 5.3 Master Data (`BE-MD`) · Traces to FR-MD

- **BE-MD-01** CRUD configurable lists (departments, program types, service types, certificate templates, field-type catalog) that drive program configuration. Referential integrity with programs.

### 5.4 Programs & Configuration (`BE-PROG`, `BE-WIZ`) · Traces to FR-PROG, FR-WIZ

- **BE-PROG-01** CRUD programs; persist wizard drafts step-by-step and allow resume.
- **BE-PROG-02** A program aggregates: schedule/days, per-day services, registration schema, feedback schema, certificate config, capacity/rules — all as data.
- **BE-PROG-03** **Status lifecycle** (Draft → Published → Registration Open → Registration Closed → Ongoing → Completed → Archived; plus Cancelled/Postponed/Rescheduled). Enforce legal transitions; reject illegal ones (e.g., Archived → Registration Open). Every transition audited.

### 5.5 Program Days & Services (`BE-DAY`) · Traces to FR-DAY

- **BE-DAY-01** Model N days per program (data-driven, not fixed).
- **BE-DAY-02** Per-day service toggles (attendance, food, feedback, etc.) with per-service parameters (e.g., food eligibility threshold). These toggles gate what the corresponding endpoints will do for that day.

### 5.6 Public Links & Tokens (`BE-LINK`) · Traces to FR-LINK

- **BE-LINK-01** Generate/regenerate the program's public registration token + QR; open/close and optional capacity/expiry.
- **BE-LINK-02** Resolve a token to its program and enforce open/closed/capacity on access.

### 5.7 Dynamic Form Engine (`BE-FORM`) · Traces to FR-FORM

Responsibility: the config engine that defines forms and validates submissions — shared by registration and feedback.

- **BE-FORM-01** Store form schemas as versioned config (fields, types, order, required, options, validation, conditional rules).
- **BE-FORM-02** Serve the schema to the frontend renderer.
- **BE-FORM-03** **Validate submissions against the schema server-side** — the authoritative check. Reject unknown/extra fields; coerce/validate types.
- **BE-FORM-04** Store submissions flexibly (e.g., JSONB) so arbitrary field sets persist without migrations, while keeping key fields queryable/indexed.
- **BE-FORM-05** Adding a field type is additive in the catalog; existing data/schemas remain valid.

### 5.8 Registration (`BE-REG`) · Traces to FR-REG

- **BE-REG-01** Accept a submission for an open link, validate against schema (5.7), and create a participant + registration record in one transaction.
- **BE-REG-02** **Duplicate prevention** via a database unique constraint on the configured identity key (e.g., email/phone per program) — not just an app check; return a clear conflict on violation.
- **BE-REG-03** Enforce capacity/close atomically (no overshoot under concurrency).
- **BE-REG-04** Optionally issue participant-specific tokens/links and trigger a confirmation notification (async).

### 5.9 Participants & Status Matrix (`BE-PART`, `BE-MTX`) · Traces to FR-PART, FR-MTX

- **BE-PART-01** Query participants with server-side filter/search/sort/pagination.
- **BE-PART-02** Provide a participant's full state: registration data, per-day attendance, food eligibility/QR/claim states, feedback state, certificate state.
- **BE-MTX-01** Compute and expose the **status matrix** keeping the five+ statuses separate (Attendance / Eligibility / QR Generated / QR Sent / Claimed / Feedback / Certificate). Never collapse "eligible" into "sent" or "claimed."
- **BE-PART-03** Permit audited manual overrides (manual attendance, eligibility override) subject to RBAC.

### 5.10 Attendance (`BE-ATT`) · Traces to FR-ATT

- **BE-ATT-01** Mark attendance for a participant on a given day via scan (token) or manual action.
- **BE-ATT-02** **Idempotent**: marking the same participant/day twice is a no-op that reports "already marked" (unique constraint on participant+day).
- **BE-ATT-03** Respect the day's service config (attendance must be enabled for that day) and program status.
- **BE-ATT-04** Attendance feeds food eligibility and certificate eligibility computations.

### 5.11 Food Eligibility & QR (`BE-FOOD`) · Traces to FR-FOOD — the concurrency-critical module

Responsibility: the attendance-based food flow with correct, idempotent bulk operations and single-use claims.

- **BE-FOOD-01 Eligibility computation.** Given a day/service, compute who is eligible from attendance per the configured rule (e.g., attended ≥ threshold). Eligibility is derived and auditable, and stored/materialized so its history is inspectable.
- **BE-FOOD-02 Generate QRs** for eligible participants (each QR = an opaque single-use token bound to participant + day + service). Regeneration policy defined and audited.
- **BE-FOOD-03 "Send to newly eligible only"** — an **idempotent** bulk operation: it notifies only participants who are eligible **and** not already sent, computed as a set difference server-side. Re-running sends nothing new. Guarded by a lock so two concurrent invocations can't double-send (see §6).
- **BE-FOOD-04 Single-use claim.** On claim scan, perform an **atomic compare-and-set**: transition Sent/Eligible → Claimed exactly once. A second scan returns "already claimed." Enforced by a unique/conditional update in the database, not application logic (see §6).
- **BE-FOOD-05** Keep QR-generated, QR-sent, and claimed as distinct, separately-queryable states.
- **BE-FOOD-06** Respect per-day food config and eligibility parameters; refuse claims for days/services where food isn't enabled.

### 5.12 Feedback (`BE-FB`) · Traces to FR-FB

- **BE-FB-01** Enable feedback at program level or per day; serve the feedback schema (5.7).
- **BE-FB-02** Accept one submission per participant per feedback scope (unique constraint); reject/short-circuit duplicates ("already recorded").
- **BE-FB-03** Aggregate responses (counts, averages, distributions, comments) for analytics endpoints.

### 5.13 Certificates (`BE-CERT`) · Traces to FR-CERT

- **BE-CERT-01** Store per-program certificate template + eligibility rule (e.g., attendance ≥ K of N days / all required / registration-only).
- **BE-CERT-02** Compute the eligible list; allow audited adjustments/overrides.
- **BE-CERT-03** Assign a **unique certificate number**, embed a verification token/QR, and **render the PDF from the template** (async job).
- **BE-CERT-04** Send certificates (async) and record delivery.
- **BE-CERT-05** Public verification resolves a number/token to Valid / Cancelled / Not found, exposing only issuing details. Support cancellation (audited).

### 5.14 Notifications (`BE-NOT`) · Traces to FR-NOT

- **BE-NOT-01** Send transactional messages (registration confirmation, food QR, certificate) via provider-agnostic interface; email first, WhatsApp/SMS as pluggable channels.
- **BE-NOT-02** Template-driven content; run through workers; record delivery status; retry with backoff.
- **BE-NOT-03** Never leak other participants' PII; each message scoped to its recipient.

### 5.15 Documentation & Files (`BE-DOC`) · Traces to FR-DOC

- **BE-DOC-01** Store uploaded supporting documents in object storage with metadata (type, description, uploader, timestamp); scan/limit file types and sizes.
- **BE-DOC-02** Generated artifacts (certificates, report exports) also live in object storage with access-controlled, expiring links.

### 5.16 Reports (`BE-RPT`) · Traces to FR-RPT

- **BE-RPT-01** Expose an **available-columns catalog** per report type so the frontend can offer column selection — no hard-coded report shape.
- **BE-RPT-02** Accept selected columns + filters and generate an **Excel** export (async for large sets), returning a download link.
- **BE-RPT-03** Enforce that data returned respects the requester's role/scope.

### 5.17 Dashboard & Analytics (`BE-DASH`) · Traces to FR-DASH

- **BE-DASH-01** Provide aggregated metrics per program and per session (registrations, attendance rate, food claimed vs eligible, feedback rate, certificates issued) via efficient queries.

### 5.18 Program Closure (`BE-CLO`) · Traces to FR-CLO

- **BE-CLO-01** Expose closure readiness gates (registration closed, attendance finalized, food finalized, feedback closed, certificates handled, docs uploaded) and block closure until satisfied.
- **BE-CLO-02** On close: finalize statistics, generate the program report, set the program read-only/archived (still reportable). Transition audited and (where defined) irreversible.

### 5.19 Audit Log (`BE-AUD`) · Traces to FR-AUD

- **BE-AUD-01** Append-only, queryable audit of all state-changing actions (actor, action, entity, timestamp, context). Read via filtered endpoints; never editable via API.

## 6. Concurrency & idempotency mechanisms (the load-bearing details)

This section is the reason the system stays correct at a busy counter. It applies the master spec's concurrency requirements concretely.

- **Registration dedup:** a **unique constraint** on (program, identity-key). Concurrent duplicate submits → one succeeds, the rest get a conflict. App-level checks alone are insufficient.
- **Attendance idempotency:** unique constraint on (participant, day[, service]); insert-on-conflict-do-nothing → marking twice is a safe no-op.
- **Single-use food claim:** the claim is a **conditional atomic update** — `UPDATE ... SET status='claimed', claimed_at=now() WHERE token=? AND status<>'claimed'` (or an insert into a claims table with a unique constraint). The number of rows affected decides the verdict: 1 = accepted, 0 = already claimed. No read-then-write race window.
- **"Send to newly eligible only":** compute the set difference (eligible − already-sent) inside a transaction, mark chosen recipients as sent, and enqueue their messages — all under a **distributed lock (Redis)** keyed by program+day+service so two operators pressing the button at once can't double-send. Idempotent by construction: a second run finds an empty delta.
- **Idempotency keys:** effectful POSTs accept an `Idempotency-Key`; a repeat with the same key returns the original result instead of acting twice.
- **Transactions** wrap every multi-write invariant; **SELECT ... FOR UPDATE** guards read-modify-write on capacity where needed.

## 7. Data model (conceptual)

Core entities and the constraints that enforce the rules above:

- **AcademicSession** 1—* **Program**
- **Program** 1—* **ProgramDay**; **Program** 1—* **ServiceConfig** (per day); **Program** 1—1 **RegistrationSchema**, **FeedbackSchema**, **CertificateConfig**
- **Program** 1—* **Participant** (**unique** (program, identity-key) → dedup)
- **Participant** 1—* **Attendance** (**unique** (participant, day) → idempotent)
- **Participant** 1—* **FoodClaim** / **FoodEligibility** (**unique** (participant, day, service) → single-use; separate flags for generated/sent/claimed)
- **Participant** 1—* **FeedbackResponse** (**unique** (participant, feedback-scope))
- **Participant** 1—1 **Certificate** (**unique** certificate number; verification token)
- **PublicToken** (opaque, scoped: registration/feedback/attendance/food/verify)
- **Document**, **ReportExport** (object-storage backed)
- **User**, **Role**, **ProgramAssignment**
- **AuditEntry** (append-only)

Dynamic submission data (registration/feedback answers) stored as JSONB keyed by schema version, with selected identity/index fields promoted to columns for querying.

## 8. Security requirements

- **BE-SEC-01** Opaque ≥128-bit tokens for all public actions; no PII in tokens, QRs, or URLs.
- **BE-SEC-02** argon2 password hashing; optional TOTP 2FA; secure session/token handling.
- **BE-SEC-03** Authorization enforced server-side on every endpoint, scoped by program where relevant.
- **BE-SEC-04** Rate limiting on public endpoints (registration, scans, verify) and on auth.
- **BE-SEC-05** Validate and sanitize all input; safe file handling for uploads.
- **BE-SEC-06** Least-privilege data exposure: responses contain only what the caller's role/scope permits.

## 9. Background jobs & queues

- **BE-JOB-01** Queue-backed workers (e.g., Redis + a job library) for bulk notifications, QR image generation, certificate PDF rendering, and report/Excel building.
- **BE-JOB-02** Jobs are retryable, idempotent, and report progress/status the frontend can poll.
- **BE-JOB-03** Long operations (certificate batch, large export) never block the request thread.

## 10. Non-functional requirements (backend)

- **BE-NFR-01 Correctness under concurrency** (see §6) — the top priority.
- **BE-NFR-02 Performance:** typical reads and scan/claim writes are fast; heavy work is async.
- **BE-NFR-03 Reliability & backups:** regular database backups; object storage durability; safe migrations.
- **BE-NFR-04 Auditability:** complete, tamper-evident audit trail.
- **BE-NFR-05 Portability:** containerized; deployable on a single cloud VPS or an on-prem VM without code change.
- **BE-NFR-06 Maintainability:** modules map 1:1 to this document; provider integrations behind interfaces.

## 11. Recommended backend technology

- **Runtime/framework:** NestJS (TypeScript) — modular structure that matches §5 cleanly.
- **Database:** PostgreSQL (relational integrity + JSONB for dynamic forms); Prisma or a comparable ORM with migrations.
- **Cache/locks/queues:** Redis + a job library (e.g., BullMQ) for distributed locks and background workers.
- **Storage:** S3-compatible object storage (MinIO on-prem).
- **PDF/QR/Excel:** a PDF renderer (e.g., Puppeteer/templating) for certificates, a QR library, and an Excel library (e.g., ExcelJS) for reports.
- **Email/WhatsApp:** provider behind an interface (SMTP/provider now; WhatsApp Business API later).

## 12. Traceability summary

Master FR → backend module: FR-SES→5.2, FR-MD→5.3, FR-PROG/FR-WIZ→5.4, FR-DAY→5.5, FR-LINK→5.6, FR-FORM→5.7, FR-REG→5.8, FR-PART→5.9, FR-MTX→5.9, FR-ATT→5.10, FR-FOOD→5.11, FR-FB→5.12, FR-CERT→5.13, FR-NOT→5.14, FR-DOC→5.15, FR-RPT→5.16, FR-DASH→5.17, FR-CLO→5.18, FR-AUD→5.19. The concurrency/idempotency requirements from the master spec are consolidated in §6.
