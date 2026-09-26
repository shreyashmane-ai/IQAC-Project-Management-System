# IQAC Program Management System
## Software Requirements Specification & High-Level Design

> **IQAC PMS** — Internal Quality Assurance Cell · Programme Management System
> Version: **1.0** (Sept 2026) · Roles: **SA / PA / PC / AO / FO / V**
> URLs — Admin console: `http://localhost:5173` · API: `http://localhost:8000/api/v1`
> OpenAPI: `http://localhost:8000/api/docs/` (Swagger) / `http://localhost:8000/api/redoc/`
> Admin login: `admin@university.edu` / `Admin@12345`
> Full project reference: `docs/PROJECT-REFERENCE.md`

| | |
|---|---|
| **Document title** | IQAC Program Management System — Requirements Specification & High-Level Design |
| **Version** | 0.1 (Draft for review) |
| **Status** | Draft — pending stakeholder discussion |
| **Date** | 25 August 2026 |
| **Prepared for** | Internal Quality Assurance Cell (IQAC) / University |
| **Audience** | IQAC coordinators, project sponsors, development team, QA |
| **Related documents** | Master Software Development Prompt (source specification) |

---

## Table of Contents

1. Introduction
2. Vision & Guiding Principles
3. Actors & Roles (overview)
4. Functional Requirements
5. Non-Functional Requirements
6. Business Rules
7. Validation Rules
8. Exception Handling & Edge Cases
9. Ambiguities, Assumptions & Open Decisions
10. System Architecture (High-Level Design)
11. Key Workflows
12. Role & Permission Matrix
13. Screen / Page Inventory
14. Implementation Phases & Roadmap
15. Acceptance Criteria
16. Open Questions for Discussion

---

# 1. Introduction

## 1.1 Purpose

This document specifies the requirements and high-level design for the **IQAC Program Management System (IQAC-PMS)** — a centralized, web-based platform that manages the complete lifecycle of university programs, from academic-session planning through registration, attendance, food distribution, feedback, certification, documentation, reporting, and annual analysis.

It consolidates and organizes the source specification into a structured requirements baseline, flags ambiguities that need decisions, and proposes a high-level architecture and technology stack. It is intended to be the reference artifact that development begins from **after** stakeholder review.

## 1.2 Scope

IQAC-PMS replaces the current patchwork of scattered Google Forms, spreadsheets, manually generated QR codes, hand-maintained attendance sheets, manual food tracking, ad-hoc feedback collection, and manual certificate processing with a single configuration-driven system.

The system covers this lifecycle:

```
Academic Session → Program Creation → Program Configuration → Unique Public Link
→ Registration → Participant Management → Program Days → Attendance
→ Food Eligibility → Food QR Generation → Food Distribution → Feedback
→ Certificate Eligibility → Certificate Generation → Program Documentation
→ Reports → Program Closure → Academic Session Analysis
```

The defining characteristic of the system is that it is **configuration-driven**: an administrator can create and operate structurally different programs (a one-day seminar, a five-day faculty development programme, a workshop with food but no certificate) **using configuration alone, with no code changes**.

## 1.3 Intended audience

- **IQAC coordinators / program administrators** — to confirm the workflows match real university operations.
- **Project sponsors / management** — to understand scope, phases, and acceptance criteria.
- **Development & QA team** — to derive detailed design, data models, test cases, and build plans.

## 1.4 How to read this document

Sections 1–3 give context and vocabulary. Section 4 is the functional heart of the system, organized by module with stable requirement IDs (e.g., `FR-ATT-03`). Sections 5–8 capture the cross-cutting rules that make the system trustworthy (non-functional requirements, business rules, validation, and exception handling). Section 9 lists the open decisions we should resolve together. Sections 10–13 describe the proposed architecture, workflows, roles, and screens at a high level. Sections 14–16 cover phasing, acceptance, and the questions to discuss next.

Requirement IDs are stable handles for discussion and traceability. Priority is expressed as **MUST** (mandatory for v1), **SHOULD** (important, include if feasible), or **COULD** (desirable, may defer).

## 1.5 Definitions, acronyms & glossary

| Term | Meaning |
|---|---|
| **IQAC** | Internal Quality Assurance Cell — the university body that owns quality processes and program records. |
| **Academic Session** | A yearly cycle running **1 April → 31 March** (e.g., 2026–27). Every program belongs to exactly one session. |
| **Program** | A single academic/administrative activity (workshop, FDP, seminar, orientation, etc.) with its own configuration. |
| **Program Day** | One dated occurrence within a program. A program has one or more days, each independently configurable. |
| **Service** | A capability that can be switched on per day: Attendance, Food, Feedback, Quiz, or Other. |
| **Participant** | A person who registers for a program. May be **Internal** (of this university) or **External**. |
| **Registration** | A participant's enrolment record for a program, produced by submitting the program's registration form. |
| **Attendance** | A dated record that a participant was present for a specific program day. |
| **Food Eligibility** | The computed right to receive a food QR for a given day/service, based on configured rules (default: present). |
| **Food QR** | A unique, secure, single-use token entitling one participant to claim food for one day/service. |
| **Claim** | The act of redeeming a food QR at a counter; distinct from having received the QR. |
| **Feedback** | Responses to a program's (or day's) dynamic feedback form. |
| **Certificate** | A verifiable document issued to eligible participants after program completion. |
| **Token** | An opaque, unguessable random string used to secure a service action without exposing participant identity. |
| **Public Link** | The shareable public URL of a program (e.g., `/p/8Kx92LmQ`). |
| **Service Link** | A sub-route for a specific service (registration, feedback). |
| **Master Data** | Reusable reference values (departments, designations, venues, resource persons, etc.). |
| **Participant Status Matrix** | The central grid showing every participant's per-day status across all services. |
| **Configuration-driven** | The property that program behavior is determined by stored configuration, not by code. |

---

# 2. Vision & Guiding Principles

## 2.1 Problem statement

University program operations are currently spread across disconnected tools. Registration lives in Google Forms, attendance in printed sheets, food counts in someone's head or a spreadsheet, feedback in yet another form, and certificates in a Word mail-merge. Data cannot be cross-referenced, duplicate-prevention is manual, food is wasted or double-claimed, "who actually attended" is hard to prove, and preparing the annual IQAC report is a painful reconciliation exercise.

## 2.2 Solution vision

A single institutional platform where an administrator configures a program once and the system generates the exact workflow that program needs — the right registration questions, the right day-wise services, attendance capture, attendance-based food eligibility with duplicate-proof QR claiming, dynamic feedback, rule-based certificates, filterable reports, and roll-up analysis for the whole academic session — all auditable.

## 2.3 Core design principle: configuration-driven

This is the single most important principle and it constrains every feature:

- **No fixed registration form.** Each program defines its own questions.
- **No fixed feedback form.** Each program (or day) defines its own questions.
- **No fixed number of days.** A program has *N* days; the UI and data expand to fit.
- **No fixed set of services.** Each day independently enables Attendance / Food / Feedback / Quiz / Other.
- **No hard-coded attendance, food, or certificate columns.** These are derived from configuration at runtime.

The acceptance test for any feature is: *could an administrator reconfigure this for a different program without a developer?* If not, the design is wrong.

## 2.4 The "always ask" design checklist

Every feature is designed against these questions (from the source specification, §56):

1. Is this configurable?
2. What happens for a one-day program? For a five-day program?
3. What happens if the user repeats the action (double-click)?
4. What happens if the participant is absent, or becomes eligible later?
5. What happens if a QR is scanned twice?
6. What happens if a notification fails?
7. What should appear in the audit log?
8. How does it appear in the participant status matrix?
9. How is it exported to Excel?
10. How does it contribute to academic-session reporting?

## 2.5 Explicitly out of scope for v1

To avoid over-engineering (source §50), the following are **not** in the initial release and are noted only so the architecture leaves room for them: online payment/fee collection, SMS/WhatsApp channels (email first), participant self-service login accounts, mobile native apps (the web app is mobile-responsive), LMS/ERP integrations, and multi-institution tenancy. Each is revisited in Section 9 as an open decision.

---

# 3. Actors & Roles (overview)

The system serves several distinct actors. Detailed permissions are in Section 12; this is the orientation.

| Actor | Description | Typical actions |
|---|---|---|
| **System Administrator** | Owns the platform configuration. | Manage users/roles, master data, academic sessions, global settings, audit. |
| **IQAC Coordinator / Program Admin** | Creates and runs programs. | Program wizard, forms, links, participants, food QR, certificates, reports, closure. |
| **Program Coordinator (per program)** | Delegated owner of a specific program. | Same as Program Admin but scoped to assigned program(s). |
| **Attendance Operator (Gate staff)** | Scans/marks attendance at a gate. | Scan participant identity, mark present; no access to PII beyond confirmation. |
| **Food Counter Operator** | Redeems food QR at the counter. | Scan food QR, issue food, see claim result only. |
| **Viewer / Reporting user** | Read-only stakeholder (e.g., HoD, management). | View dashboards and permitted reports; export where allowed. |
| **Participant** | External/internal registrant. | View public page, register, receive QR/certificate, submit feedback — **link/token based, no login in v1**. |

---

# 4. Functional Requirements

## 4.1 Academic Session Management

**Purpose:** Organize every program under a yearly session (1 April → 31 March) and provide session-level roll-ups.

- **FR-SES-01 (MUST):** Create, edit, activate, close, and archive academic sessions. A session has a code (e.g., `2026-27`), start date (1 April), and end date (31 March).
- **FR-SES-02 (MUST):** Exactly one session is "active" at a time for defaulting new programs; users may still assign a program to any open session.
- **FR-SES-03 (MUST):** Every program must belong to exactly one session (enforced at creation).
- **FR-SES-04 (MUST):** View all programs within a session with status and key statistics.
- **FR-SES-05 (MUST):** Session-wise statistics and reports (programs, registrations, attendance, food, feedback, certificates).
- **FR-SES-06 (SHOULD):** Closing a session locks its programs against further edits except explicitly permitted corrections; archived sessions remain fully readable for historical analysis.
- **FR-SES-07 (SHOULD):** Prevent deletion of a session that has programs; require archive instead.

## 4.2 Master Data Management

**Purpose:** Reusable reference values so administrators select rather than retype, ensuring clean, aggregatable data.

- **FR-MD-01 (MUST):** Maintain masters for: Academic Departments, Administrative Departments, Designations, Program Types, Program Categories, Venues, Resource Persons, Participant Types, Institution Types, Question Types, Certificate Types, Food Types, and generic reusable configuration lists.
- **FR-MD-02 (MUST):** Academic and Administrative departments are **separate categories** but selectable through one common department picker (grouped/labelled).
- **FR-MD-03 (MUST):** Each master supports create, edit, activate/deactivate, and safe archive (deactivated values remain valid on historical records but are hidden from new selections).
- **FR-MD-04 (SHOULD):** Prevent hard-deletion of master values in use; deactivate instead. Show usage count.
- **FR-MD-05 (COULD):** Import master data via spreadsheet for initial setup.

## 4.3 Program Management

**Purpose:** The central entity. A program carries descriptive information plus its full service configuration.

- **FR-PROG-01 (MUST):** Create a program capturing: academic session, title, program type, program category, organizing department, collaborating department(s), target department(s), start date, end date, number of days, venue, time, program coordinator, resource person(s), maximum participants, target participant types, objective, expected outcomes, description, contact information, and program documents.
- **FR-PROG-02 (MUST):** Support the full program status lifecycle: **Draft, Published, Registration Open, Registration Closed, Ongoing, Completed, Archived, Cancelled, Postponed, Rescheduled.** Status transitions are controlled and audited (see §11.9 and §6).
- **FR-PROG-03 (MUST):** Global program search by name, ID, session, department, type, category, date, and status (source §38).
- **FR-PROG-04 (MUST):** A per-program admin workspace (see §13) exposing Overview, Registration, Participants, Attendance, Food, Feedback, Certificates, Documents, Reports, Links & QR, Settings, and Audit Log, with summary statistics on top.
- **FR-PROG-05 (SHOULD):** Duplicate/clone an existing program (including its form and day configuration) as a starting point for a new one.
- **FR-PROG-06 (SHOULD):** Postpone / reschedule updates dates and program-day dates coherently and notifies affected registrants (see §8 edge cases).

## 4.4 Program Creation Wizard

**Purpose:** A guided, resumable, revisitable multi-step flow so a non-technical administrator can configure a complete program.

- **FR-WIZ-01 (MUST):** Provide a 12-step wizard: (1) Basic info, (2) Departments & target participants, (3) Date/time/venue/duration, (4) Configure program days, (5) Registration, (6) Attendance, (7) Food, (8) Feedback, (9) Certificate, (10) Notifications, (11) Review, (12) Save Draft / Publish.
- **FR-WIZ-02 (MUST):** The administrator can move backward to any prior step and modify configuration; changes propagate consistently (e.g., changing day count re-syncs day configuration — see §8).
- **FR-WIZ-03 (MUST):** Save as Draft at any step without full validation; full validation is enforced only at Publish.
- **FR-WIZ-04 (MUST):** Step 11 shows a complete, human-readable review of the entire configuration before publishing.
- **FR-WIZ-05 (SHOULD):** Per-step validation with clear inline guidance; the review step lists anything incomplete with a jump link to fix it.

## 4.5 Program Days & Day-wise Services

**Purpose:** Turn "number of days" into independently configurable day records — the mechanism behind configuration-driven workflows.

- **FR-DAY-01 (MUST):** Setting *Number of Days = N* auto-generates Day 1…Day N, each with its own date.
- **FR-DAY-02 (MUST):** Each day independently toggles services: **Attendance, Food, Feedback, Quiz, Other.** Example: Day 1 = Attendance+Food; Day 3 = Attendance+Feedback; Day 4 = Attendance only.
- **FR-DAY-03 (MUST):** The system derives all downstream structures (attendance sessions, food services, feedback instances, matrix columns, report columns) from this per-day configuration at runtime — never hard-coded.
- **FR-DAY-04 (MUST):** Changing N after creation adds/removes day records safely, warning about and protecting any day that already has transactional data (see §8, edge cases 11–13).
- **FR-DAY-05 (SHOULD):** A day may be individually cancelled without deleting its historical data.
- **FR-DAY-06 (COULD):** Per-day metadata (session title, timing, resource person for that day) for richer schedules and reports.

## 4.6 Program Links & QR

**Purpose:** Every program is publicly shareable, with clean separation between public and internal URLs.

- **FR-LINK-01 (MUST):** On creation, auto-generate a unique public link using an unguessable slug, e.g., `https://iqac.example/p/8Kx92LmQ`.
- **FR-LINK-02 (MUST):** The public program page displays configured public information: title, description, date, time, venue, resource person(s), organizing department, objectives, schedule, a Register button, and contact details.
- **FR-LINK-03 (MUST):** Conceptually distinct service links: Public (`/p/{slug}`), Registration (`/p/{slug}/register`), Feedback (`/p/{slug}/feedback`). Attendance and Food use **secure per-participant/per-service tokens**, never PII in the URL.
- **FR-LINK-04 (MUST):** Each service has an independent status: **Scheduled, Active, Closed, Disabled.** Disabling registration MUST NOT disable the main public page.
- **FR-LINK-05 (MUST):** A dedicated "Links & QR" section per program to copy, share, generate QR, download QR, and enable/disable each link. Internal admin URLs are never exposed publicly.
- **FR-LINK-06 (SHOULD):** Program-level QR (encoding the public link) for posters/circulars.

## 4.7 Dynamic Form Engine (shared by Registration & Feedback)

**Purpose:** One reusable form builder powers both registration and feedback, so any program can have any questions.

- **FR-FORM-01 (MUST):** Build a form by adding, editing, deleting, disabling, duplicating, and reordering questions; mark each required/optional; preview; and publish.
- **FR-FORM-02 (MUST):** Copy questions from another program's form.
- **FR-FORM-03 (MUST):** Support question types: Short Answer, Long Answer, MCQ (single), MSQ (multi), Number, Decimal, Email, Mobile Number, Dropdown, Checkbox, Yes/No, Rating, Date, File Upload. The type system MUST be extensible to add new types without schema redesign.
- **FR-FORM-04 (MUST):** Per-type configuration, e.g.: MCQ/MSQ/Dropdown options; Number/Decimal min/max and decimal places; text min/max length; file allowed types and max size; rating scale.
- **FR-FORM-05 (MUST):** Server-side validation of every answer against its question configuration before acceptance (client validation is convenience only).
- **FR-FORM-06 (SHOULD):** Editing a published form that already has responses is version-aware: existing responses remain interpretable; destructive changes are warned about or blocked (see §8).
- **FR-FORM-07 (SHOULD):** Conditional/dynamic fields — e.g., show Institution/City/State only when Participant Type = External (see §4.9).

## 4.8 Registration & Capacity

**Purpose:** Convert form submissions into managed participant records with duplicate prevention and capacity control.

- **FR-REG-01 (MUST):** Registration workflow: open link → view details → Register → complete dynamic form → submit → validate → duplicate check → capacity check → create registration → generate registration number → confirmation → send confirmation.
- **FR-REG-02 (MUST):** Registration open/close is independent of the public page (per §4.6).
- **FR-REG-03 (MUST):** Enforce maximum capacity; when full, either close or divert to waitlist (configurable).
- **FR-REG-04 (MUST):** Duplicate-registration prevention using a configured identity key (e.g., email and/or mobile) per program; a clear message is shown on duplicate.
- **FR-REG-05 (MUST):** Registration states: submitted, approved, rejected, waitlisted, cancelled. Approval may be required or automatic (configurable per program).
- **FR-REG-06 (MUST):** Generate a unique, human-readable registration number per participant per program.
- **FR-REG-07 (SHOULD):** Waitlist promotion (manual, with automatic option) when capacity frees up; promoted participants are notified.
- **FR-REG-08 (SHOULD):** Participant may later have registration details edited by staff (audited); self-edit is out of v1 scope.

## 4.9 Participant Management (Internal & External)

**Purpose:** Handle both university-internal and external participants with the right fields for each.

- **FR-PART-01 (MUST):** Support Internal and External participant types. Internal participants select Department and Designation from masters; External participants provide Institution, Department, Designation, City, State, and other required fields.
- **FR-PART-02 (MUST):** The registration form dynamically shows/hides fields based on participant type (conditional logic per FR-FORM-07).
- **FR-PART-03 (MUST):** A participant profile view aggregating personal details, programs registered/attended, day-wise attendance, food claims, feedback submitted, certificates, and communication history — subject to permissions (source §39).
- **FR-PART-04 (SHOULD):** Optional cross-program identity linking (same person across programs by email/mobile) to power the profile; must respect privacy (see §9).

## 4.10 Attendance Management

**Purpose:** Reliable, day-wise, multi-gate attendance with strict duplicate prevention and audited manual correction.

- **FR-ATT-01 (MUST):** Attendance is configured per day (only days with Attendance enabled have an attendance session).
- **FR-ATT-02 (MUST):** Capture workflow: day active → attendance service active → participant presents identity/QR → validate participant → validate program → validate day → duplicate check → mark present → record date/time, gate/operator → show result.
- **FR-ATT-03 (MUST):** Support multiple simultaneous scanners/gates (Gate 1, Gate 2, Gate 3, …) all writing to the same program attendance data safely under concurrency (see §10.8).
- **FR-ATT-04 (MUST):** Duplicate scans for the same day do **not** create a second record; show "Attendance already marked" and retain the original (first) transaction with its timestamp and operator.
- **FR-ATT-05 (MUST):** Authorized manual correction: mark present, mark absent, correct a wrong scan, remove an incorrect record. Every manual change is audited with user, timestamp, previous value, new value, and reason.
- **FR-ATT-06 (MUST):** Late attendance is accepted while the session is active and is flagged as late where relevant (see §8, edge case 4).
- **FR-ATT-07 (SHOULD):** The identification mechanism (how a participant is recognized at the gate) is defined as a per-participant attendance token/QR issued at registration — pending confirmation (see §9, open decision O-2).

## 4.11 Food Management

**Purpose:** Attendance-based food eligibility with unique, single-use QR and the "send only new eligible" capability — a critical, waste-preventing feature.

- **FR-FOOD-01 (MUST):** Food QR is **never** sent to all registrants. Eligibility is rule-based; the default rule is **Attendance = Present** for that day/service.
- **FR-FOOD-02 (MUST):** Generation & send workflow: identify eligible participants → exclude those already sent → generate unique food QR → send → record delivery status.
- **FR-FOOD-03 (MUST) — "Send only new eligible":** When triggered, select participants where Attendance = Present **AND** Food QR Sent = No, and send only to them. Previously served participants are never re-sent. (Example: 80 sent initially; 5 more become present; the action sends to exactly those 5.)
- **FR-FOOD-04 (MUST):** Each food QR is unique to the tuple (participant, program, day, food service) and carries a **secure random token**; no common QR for all, and no PII embedded in the QR.
- **FR-FOOD-05 (MUST):** Claim workflow: participant presents QR at counter → staff scans → validate QR → validate program → validate day → validate service → check already-claimed → if valid, issue food and mark claimed → if already claimed, reject with "Food already claimed." A QR is single-use.
- **FR-FOOD-06 (MUST):** Maintain **separate** statuses: Attendance, Food Eligibility, Food QR Generated, Food QR Sent, Food Claimed. "QR Sent" MUST NOT be treated as "Claimed" — a participant may receive a QR yet never collect food.
- **FR-FOOD-07 (MUST):** Repeated clicks of "Generate & Send Food QR" must not resend to already-served participants (idempotent — see §10.8).
- **FR-FOOD-08 (MUST):** Pre-send summary panel showing Eligible, Already Sent, and New; a single action "Send to N New Eligible Participants"; and a post-send result (Sent / Failed). (Source §47.)
- **FR-FOOD-09 (SHOULD):** Alternative eligibility rules configurable per program/day (e.g., registration-only, or present on a specific prior day).

## 4.12 Feedback Management & Analytics

**Purpose:** Program-specific feedback, single or day-wise, using the same dynamic form engine, with automatic analytics.

- **FR-FB-01 (MUST):** Two feedback modes, configurable per program: (A) one feedback for the whole program, or (B) separate feedback per selected day (e.g., feedback on Days 1, 2, 3, 5 but not Day 4).
- **FR-FB-02 (MUST):** Feedback forms use the dynamic form engine (§4.7) and support the same rich question types; each program can have entirely different feedback questions.
- **FR-FB-03 (MUST):** Feedback link/service has its own status (scheduled/active/closed/disabled) and window.
- **FR-FB-04 (MUST):** Automatic analytics: response count, average rating, question-wise average, rating distribution, satisfaction percentage, resource-person rating, program-relevance rating, and free-text suggestions/comments, with charts where appropriate.
- **FR-FB-05 (SHOULD):** Feedback may be anonymous or linked to the participant (configurable), affecting the participant matrix display and privacy handling (see §9).
- **FR-FB-06 (SHOULD):** Prevent duplicate feedback submissions per participant per feedback instance where feedback is identified.

## 4.13 Participant Status Matrix

**Purpose:** The single most important operational screen — one grid showing every participant's complete status, with columns that adapt to configuration.

- **FR-MTX-01 (MUST):** Present a matrix with a row per participant and columns for Registration, each enabled day's Attendance and Food, Feedback, and Certificate. Columns are generated automatically from the program's day/service configuration.
- **FR-MTX-02 (MUST):** Use clear status symbols: ✓ = completed, ✗ = not completed, — = not applicable (service not enabled that day).
- **FR-MTX-03 (MUST):** Filter by participant name, department, designation, participant type, and by registration/attendance/food/feedback/certificate status, date, and other registration fields; plus free-text search.
- **FR-MTX-04 (MUST):** Row actions (permission-gated): view participant, registration, attendance, food transactions, feedback, certificate, and communication history; export.
- **FR-MTX-05 (SHOULD):** Bulk selection for bulk actions (approve, notify, generate/send food QR, generate certificates) with confirmation.

## 4.14 Certificate Management & Verification

**Purpose:** Configurable eligibility, verifiable issuance, and public verification.

- **FR-CERT-01 (MUST):** Configurable eligibility rules per program, at least: attendance ≥ X% (e.g., 75%), present on at least K of N days, present on all required days, registration-only, or a custom rule.
- **FR-CERT-02 (MUST):** Generation workflow: program completed → finalize attendance → check eligibility → generate certificates → assign unique certificate number → embed verification QR → send → record delivery.
- **FR-CERT-03 (MUST):** Each certificate shows certificate number, participant name, program name, program date, issuing organization, and a verification QR.
- **FR-CERT-04 (MUST):** Public verification endpoint returns one of: **VALID, CANCELLED, NOT FOUND.**
- **FR-CERT-05 (MUST):** Certificates can be cancelled/revoked (audited), which flips verification to CANCELLED.
- **FR-CERT-06 (SHOULD):** Configurable certificate template with placeholders (name, program, dates, signatures/logos) so different programs/certificate types render correctly without code changes.
- **FR-CERT-07 (SHOULD):** Re-generation is guarded so numbers are not duplicated and previously issued certificates are not silently overwritten.

## 4.15 Notifications

**Purpose:** Reusable templated communications with delivery tracking and safe (non-duplicate) sending.

- **FR-NOT-01 (MUST):** Reusable templates for: registration confirmation, registration approval, registration rejection, program reminder, food QR, feedback invitation, certificate, program cancellation, program rescheduling.
- **FR-NOT-02 (MUST):** Track delivery state per message: Pending, Sent, Failed. Prevent accidental repeated sending; provide an explicit "Resend" action.
- **FR-NOT-03 (MUST):** Email is the v1 channel; the design abstracts the channel so SMS/WhatsApp can be added later (see §9).
- **FR-NOT-04 (SHOULD):** Templates support program/participant placeholders and attachments (QR image, certificate PDF).
- **FR-NOT-05 (SHOULD):** A per-program communication log feeding the participant profile/matrix.

## 4.16 Program Document Management

**Purpose:** A centralized document store per program.

- **FR-DOC-01 (MUST):** Upload, categorize, view, and remove documents per program, including: circular, poster, brochure, permission letter, resource-person profile, presentation, attendance evidence, photographs, feedback report, program report, and other supporting documents.
- **FR-DOC-02 (SHOULD):** File type/size validation and virus-safe handling; access controlled by permission.
- **FR-DOC-03 (SHOULD):** Photographs feed into the auto-generated program report (§4.19).

## 4.17 Reporting & Export

**Purpose:** Highly configurable, column-selectable reports with Excel export.

- **FR-RPT-01 (MUST):** Report workflow: select program → select report → apply filters → **select columns** → preview → export to Excel. Only selected columns are exported.
- **FR-RPT-02 (MUST):** Provide report types: Registration, Attendance, Food, Feedback, Certificate, Participant Status, Complete Program, Department-wise, Academic Session, and Custom.
- **FR-RPT-03 (MUST):** Column choices adapt to program configuration (e.g., per-day attendance/food columns appear only for enabled days).
- **FR-RPT-04 (MUST):** Export honors the requesting user's permissions (e.g., PII columns hidden from users who cannot see PII) and is audited.
- **FR-RPT-05 (SHOULD):** Saveable report presets (named column/filter sets) for repeated use.

## 4.18 Dashboards

**Purpose:** Role-appropriate overviews at the admin, program, and session levels.

- **FR-DASH-01 (MUST):** Admin dashboard: current session, upcoming/ongoing/completed programs, registration/attendance/feedback/certificate statistics, and quick actions (create program, manage programs, registration, attendance, feedback, certificates, reports).
- **FR-DASH-02 (MUST):** Per-program dashboard with summary counters (e.g., Registered 125, Present 112, Food Claimed 108, Feedback 101, Certificates 105) and navigation to all program sections.
- **FR-DASH-03 (MUST):** Annual IQAC dashboard per academic session: totals (programs, registrations, participants, attendance, food claims, feedback responses, certificates) and breakdowns (department-wise, program-type-wise, month-wise, participant-type analysis, attendance analysis, feedback analysis) with charts and tables.

## 4.19 Program Report & Closure

**Purpose:** One-click program report generation and a controlled closure sequence.

- **FR-CLO-01 (MUST):** "Generate Program Report" auto-assembles: title, session, dates, venue, organizing department, resource person(s), objectives, outcomes, and registration/attendance/feedback/certificate statistics, plus photographs and other configured content; the administrator reviews/edits before final generation.
- **FR-CLO-02 (MUST):** Closure workflow: program completed → close registration → finalize attendance → finalize food → close feedback → calculate statistics → check certificate eligibility → generate certificates → generate program report → upload supporting documents → review → archive.
- **FR-CLO-03 (MUST):** Archived programs remain fully available for historical and session reporting (read-only).

## 4.20 Audit Log

**Purpose:** Traceability of important actions.

- **FR-AUD-01 (MUST):** Log program creation/update/cancellation, registration modification, attendance correction, food correction, QR generation, QR sending, certificate generation, certificate cancellation, export operations, and user-permission changes.
- **FR-AUD-02 (MUST):** Each entry records who, when, what changed (before/after where applicable), and — for corrections — the reason.
- **FR-AUD-03 (SHOULD):** Audit entries are immutable and filterable/searchable by actor, entity, action, and date; visible at both global and per-program scope.

---

# 5. Non-Functional Requirements

| ID | Category | Requirement |
|---|---|---|
| **NFR-SEC-01** | Security | All traffic over HTTPS/TLS. Role-based access control on every action. Server-side authorization on every request — never trust the client. |
| **NFR-SEC-02** | Security | Service tokens (attendance, food, verification) are cryptographically random (≥128-bit entropy), opaque, and carry no PII. Tokens are single-purpose and, where applicable, single-use. |
| **NFR-SEC-03** | Security | Passwords hashed with a modern KDF (bcrypt/argon2); optional 2FA for admin roles. Session/JWT expiry and rotation. Rate-limiting and CAPTCHA on public endpoints (registration, verification) to deter abuse. |
| **NFR-SEC-04** | Security | Input sanitization and output encoding to prevent injection/XSS; parameterized queries; file-upload type/size checks and safe storage. |
| **NFR-PRV-01** | Privacy | Participant PII is minimized, access-controlled, and exportable only by permitted roles. Retention and consent align with Indian DPDP Act 2023 principles (see §9, O-6). |
| **NFR-CON-01** | Concurrency | Correctness under concurrent access: multiple gates marking attendance and repeated action clicks must never create duplicates or resend QRs. Enforced by DB constraints + transactions + idempotency (see §10.8). |
| **NFR-PERF-01** | Performance | Common screens (dashboards, matrix for a typical program of ≤1,000 participants) respond in < 2 s under normal load. Scan/claim validation responds in < 1 s. |
| **NFR-SCAL-01** | Scalability | Handle the institution's realistic peak: dozens of concurrent programs per session, thousands of participants per large program, and multiple simultaneous scanners per program. Reports and exports run asynchronously for large datasets. |
| **NFR-AVAIL-01** | Availability | Target 99.5%+ during active program hours; graceful degradation and clear messaging on failure (never silent failure). |
| **NFR-UX-01** | Usability | Clean dashboard, minimal clicks, clear status indicators, search/filters, bulk actions, and confirmation before destructive actions. |
| **NFR-UX-02** | Responsiveness | Fully responsive; scanning screens are mobile-first and work well on phones/tablets used at gates and counters. |
| **NFR-A11Y-01** | Accessibility | Forms and key screens meet WCAG 2.1 AA basics (labels, contrast, keyboard navigation, error messaging). |
| **NFR-MNT-01** | Maintainability | Modular, documented, no hard-coded program-specific logic/questions/day-counts/columns; no duplicated business logic. |
| **NFR-COMP-01** | Compatibility | Latest two versions of major browsers (Chrome, Edge, Firefox, Safari). Camera-based QR scanning via the browser. |
| **NFR-BKP-01** | Reliability | Automated database backups and a documented restore procedure; uploaded files backed up. |
| **NFR-OBS-01** | Observability | Application logging, error tracking, and delivery logs for notifications to support diagnosis. |

---

# 6. Business Rules

Business rules are the enforceable policies behind the features. They are authoritative on the server.

**Session & program**

- **BR-01:** A program belongs to exactly one academic session and inherits its April–March boundary.
- **BR-02:** Program status transitions follow the allowed path (see §11.9). Illegal transitions are rejected (e.g., cannot go Archived → Registration Open).
- **BR-03:** A program cannot open registration unless it is at least Published and has an active registration service.
- **BR-04:** Disabling the registration service never disables the public program page (and vice versa).

**Days & services**

- **BR-05:** Only days with a service enabled generate that service's structures (attendance session, food service, feedback instance, matrix/report columns).
- **BR-06:** Reducing the number of days may not silently delete a day that already has transactional data; it must warn and require explicit confirmation/handling.

**Registration**

- **BR-07:** A participant is unique within a program by the configured identity key (email and/or mobile). A second attempt is a duplicate.
- **BR-08:** When capacity is reached, new registrations are either blocked or waitlisted per configuration — never silently accepted beyond capacity.
- **BR-09:** Only approved (or auto-approved) participants count toward capacity and appear as confirmed; waitlisted/rejected do not.

**Attendance**

- **BR-10:** Attendance is unique per (participant, program, day). The first successful scan wins; later scans that day are acknowledged, not duplicated.
- **BR-11:** Attendance can only be captured while that day's attendance service is Active.
- **BR-12:** Manual attendance changes require a reason and are audited with before/after values.

**Food**

- **BR-13:** Food eligibility is computed from the configured rule (default: Present that day). Only eligible participants can be issued a food QR.
- **BR-14:** A food QR is unique per (participant, program, day, food service) and single-use.
- **BR-15:** "Send Food QR" targets only eligible AND not-yet-sent participants (idempotent send).
- **BR-16:** "QR Sent" ≠ "Claimed." Claiming is a separate, one-time event validated at the counter.
- **BR-17:** A food QR can be claimed at most once; a second claim is rejected.

**Feedback**

- **BR-18:** Feedback structure (single vs. day-wise) is fixed by configuration; day-wise feedback only exists for days configured for it.
- **BR-19:** Where feedback is identified (non-anonymous), a participant may submit each feedback instance at most once.

**Certificate**

- **BR-20:** Certificate eligibility is evaluated against finalized attendance using the program's configured rule.
- **BR-21:** Certificate numbers are unique and never reused; cancellation revokes validity without deleting the record.
- **BR-22:** Certificates are generated only after attendance is finalized (program Completed/closure path).

**Notifications & audit**

- **BR-23:** A given templated message is not sent twice to the same recipient for the same trigger unless an explicit Resend is performed.
- **BR-24:** Every action listed in §4.20 produces an audit entry; audit entries are append-only.

---

# 7. Validation Rules

Validation is layered: the client gives immediate feedback, but the **server is authoritative** and re-validates everything.

**Field-level (driven by question configuration):**

- Required fields must be present and non-empty.
- Number/Decimal: numeric, within min/max, decimal places within configured precision.
- Email: valid format; Mobile: configured length/format (e.g., 10-digit Indian mobile).
- Text: within min/max length.
- MCQ/Dropdown: value must be one of the configured options; MSQ/Checkbox: all selected values valid; respect any min/max selection count.
- Date: valid date, within any configured range.
- File Upload: allowed MIME/type and within max size; filename sanitized.
- Rating: within the configured scale.

**Form-level:**

- Conditional fields are validated only when visible (e.g., External-only fields).
- The whole submission is validated atomically; partial saves are not persisted as registrations.

**Domain-level:**

- Duplicate identity key → reject with a friendly duplicate message.
- Capacity exceeded → block or waitlist per config.
- Service not active / window closed → reject with a clear status message.
- Token validation (attendance/food/verification): exists, matches program/day/service, not expired, not already used (for single-use).

**Configuration-time (wizard):**

- Number of days ≥ 1; end date ≥ start date; day dates within program range.
- At least one contactable field required if confirmations are enabled.
- Certificate rule parameters valid (e.g., percentage 0–100; K ≤ N).
- Publish is blocked until mandatory configuration is complete; Draft is always allowed.

---

# 8. Exception Handling & Edge Cases

Principle: **never fail silently.** Every exception yields a clear, user-friendly message, the correct state, and (for administrative actions) an audit entry. The table maps each scenario to expected behavior.

| # | Scenario | Expected behavior |
|---|---|---|
| 1 | Duplicate registration | Reject; message "You have already registered for this program." Point to existing registration number if identified. |
| 2 | Participant registers but never attends | Valid state. Not food-eligible; not attendance-complete; certificate per rule (likely ineligible). Shown accurately in matrix. |
| 3 | Attends Day 1 but not Day 2 | Day 1 present, Day 2 absent. Food/certificate computed per day and rule accordingly. |
| 4 | Attends Day 2 *after* food QR already sent | Becomes newly eligible; picked up by "Send only new eligible"; original recipients not re-sent. |
| 5 | Late attendance | Accepted while session active; flagged late where relevant; after close, requires manual correction (audited). |
| 6 | Scans attendance multiple times | First scan recorded; later scans show "Attendance already marked"; no duplicate. |
| 7 | Scans food QR multiple times | First valid scan issues food; later scans show "Food already claimed." |
| 8 | Admin clicks "Send Food QR" repeatedly | Idempotent: only not-yet-sent eligible participants are sent; repeats send to no one and report 0 new. |
| 9 | Email delivery fails | Marked Failed with reason; surfaced for retry via explicit Resend; never silently dropped. |
| 10 | Participant changes registration details | Staff edit is audited (before/after). Re-validation applies; identity-key change re-checks duplicates. |
| 11 | Program postponed | Dates/day-dates updated coherently; affected registrants notified (rescheduling template); links preserved. |
| 12 | Program duration changes (N changes) | Days added/removed safely; days with existing data are protected and require explicit handling; matrix/report columns re-derive. |
| 13 | A day is cancelled | Day marked cancelled; its services stop; historical data retained; matrix shows — for that day going forward. |
| 14 | Food disabled for one day | No food service/QR for that day; matrix shows — in that day's food column. |
| 15 | Feedback enabled only on selected days | Feedback instances exist only for those days; others show — for feedback. |
| 16 | Certificate eligibility changes before final generation | New rule applies at generation; if already generated, changes are guarded/audited to avoid duplicate numbers or silent overwrite. |
| 17 | Participant manually marked present | Allowed for authorized users; audited with reason; may make participant food/certificate eligible. |
| 18 | Participant removed/cancelled | Excluded from active counts and eligibility; historical transactions retained and clearly flagged. |
| 19 | Registration capacity reached | Block or waitlist per config; clear message; waitlisted participants can be promoted later. |
| 20 | Waitlisted participant promoted | Moves to confirmed if capacity allows; notified; now counts toward capacity and eligibility. |
| 21 | Multiple scanners operate simultaneously | Concurrency-safe: unique constraints + transactions ensure exactly one attendance/claim record (see §10.8). |
| 22 | Invalid / expired / wrong-program / wrong-day QR | Reject with the specific reason ("Invalid QR", "QR expired", "Wrong program", "Wrong day"). |
| 23 | Registration or feedback closed | Public shows closed status; submission attempts are rejected with the reason. |
| 24 | Program cancelled | Public page reflects cancellation; services disabled; registrants notified; data retained. |
| 25 | Missing participant information | Blocked at validation with specific field guidance; never partially saved. |
| 26 | Network interruption during scan | Scan is transactional and idempotent; on retry the same token yields the same result (no double record). Offline queueing is an open decision (§9, O-4). |

---

# 9. Ambiguities, Assumptions & Open Decisions

The source specification is unusually complete, but a few points are underspecified or imply choices. This section records the **assumptions** made to keep moving and the **open decisions** to resolve together. Each open decision has a recommended default so we can proceed unless you say otherwise.

## 9.1 Working assumptions

- **A-1:** Single institution (one university); departments are internal divisions, not tenants.
- **A-2:** Participants do **not** log in (v1). All participant interactions are via public links and secure tokens.
- **A-3:** **Email** is the only notification channel in v1; the design abstracts channels for future SMS/WhatsApp.
- **A-4:** Programs are **free**; no payment/fee collection in v1.
- **A-5:** UI language is **English** in v1.
- **A-6:** Venues have **reliable connectivity** for scanning in v1 (idempotent tokens make brief drops safe).
- **A-7:** Exactly one **active** academic session is used to default new programs (others remain selectable).

## 9.2 Open decisions (need your input)

| ID | Topic | The question | Recommended default |
|---|---|---|---|
| **O-1** | Participant auth | Do participants ever log in, or is everything link/token based? | Token/link based, no participant accounts in v1. |
| **O-2** | Attendance identity | How is a participant recognized at the gate? | Issue a **per-participant attendance QR/token at registration** (in the confirmation email), plus a manual lookup fallback by registration number/email. |
| **O-3** | QR/notification delivery | How are QRs delivered? | Email with QR as inline image **and** PDF attachment. |
| **O-4** | Offline scanning | Must gates/counters work with no network? | Not in v1; rely on venue network + idempotent tokens. Offline queue-and-sync considered for a later phase. |
| **O-5** | Multi-institution | One university or many? | One institution (single tenant). |
| **O-6** | Privacy & retention | Consent text, retention period, erasure requests (DPDP Act 2023)? | Capture consent at registration; define a retention window per session; support admin-initiated erasure. Needs policy input. |
| **O-7** | Feedback anonymity | Anonymous or identified feedback? | Configurable per program; default **identified** (enables matrix + duplicate prevention), with an anonymous option. |
| **O-8** | Registration approval | Is approval usually required? | Configurable per program; default **auto-approve**, with an approval mode available. |
| **O-9** | Waitlist promotion | Manual or automatic? | Manual by default, with an optional auto-promote toggle. |
| **O-10** | Certificate templates | Who provides templates, logos, signatures? | Placeholder-based HTML template engine; we need a sample certificate design, signatory names/titles, and logo assets. |
| **O-11** | Hosting & email | Cloud vs on-prem, domain, SMTP provider? | Dockerized deployment on an institution VM or cloud; a transactional email provider/SMTP with adequate bulk throughput. Needs input. |
| **O-12** | "Quiz" service | The spec lists Quiz as a day service but does not detail it. | Treat as a light "Other/Quiz" placeholder in v1 (link out or simple config); full quiz engine deferred. |
| **O-13** | Identity key | Which field(s) make a registration unique? | Configurable per program; default **email**, optionally email+mobile. |

*(These map to the consolidated discussion list in Section 16.)*

---

# 10. System Architecture (High-Level Design)

## 10.1 Architectural style

A **modular monolith with an API-first core and asynchronous workers** — the pragmatic sweet spot for an institutional system: simpler to build, deploy, and operate than microservices, while keeping clean module boundaries so parts can be extracted later if ever needed. Public pages are server-rendered (fast, shareable, correct link previews); the admin console is a rich single-page app; scanning is a mobile-first progressive web app. Heavy or slow work (sending email, generating QR/PDF, building large Excel exports) runs on background workers so the UI stays responsive.

## 10.2 Logical layers

```
┌─────────────────────────────────────────────────────────────────────┐
│                            CLIENT TIER                                │
│  Public pages (SSR)     Admin console (SPA)     Scanner PWA (mobile)  │
│  program / register /   dashboards, wizard,     attendance & food     │
│  feedback / verify      matrix, reports         QR scan + claim       │
└───────────────┬──────────────────┬────────────────────┬──────────────┘
                │  HTTPS (REST/JSON)                     │
┌───────────────▼──────────────────▼────────────────────▼──────────────┐
│                       APPLICATION / API TIER                          │
│  AuthN + RBAC  ·  Request validation  ·  Rate limiting  ·  Audit hook │
│  ───────────────────────── Domain modules ─────────────────────────  │
│  Session · MasterData · Program · FormEngine · Registration ·         │
│  Attendance · Food · Feedback · Certificate · Notification ·          │
│  Reporting · Documents · Dashboard/Analytics · AuditLog               │
└───────────────┬───────────────────────────────────┬──────────────────┘
                │                                     │ enqueue jobs
┌───────────────▼─────────────────┐   ┌───────────────▼──────────────────┐
│           DATA TIER             │   │        ASYNC WORKERS              │
│  PostgreSQL (relational+JSONB)  │   │  Email send · QR/PDF generate ·   │
│  Redis (cache, locks, queues)   │   │  Excel export · report assembly   │
│  Object storage (files/QR/PDF)  │   └───────────────┬──────────────────┘
└─────────────────────────────────┘                   │
                                        ┌──────────────▼──────────────┐
                                        │   External: SMTP / email     │
                                        │   (future: SMS/WhatsApp, SSO)│
                                        └──────────────────────────────┘
```

## 10.3 Module decomposition

| Module | Responsibility |
|---|---|
| **Academic Session** | Session lifecycle, active-session logic, session roll-ups. |
| **Master Data** | Reference lists; activate/deactivate; usage protection. |
| **Program** | Program entity, status lifecycle, wizard orchestration, cloning, search. |
| **Form Engine** | Shared question/answer model, validation, preview, copy — used by Registration and Feedback. |
| **Registration** | Submissions, duplicate/capacity/waitlist logic, registration numbers, approval. |
| **Attendance** | Day-wise sessions, scan/claim of attendance tokens, duplicate prevention, manual correction. |
| **Food** | Eligibility computation, food-token issuance, idempotent send, single-use claim, status separation. |
| **Feedback** | Single/day-wise instances, responses, analytics aggregation. |
| **Certificate** | Eligibility evaluation, generation, numbering, verification, cancellation. |
| **Notification** | Templates, message dispatch, delivery tracking, resend, channel abstraction. |
| **Documents** | Per-program file store with categories and access control. |
| **Reporting** | Column-selectable reports, filters, async Excel export. |
| **Dashboard/Analytics** | Admin, program, and annual IQAC dashboards and charts. |
| **Audit Log** | Append-only recording of sensitive actions; query/filter. |
| **Identity & Access** | Users, roles, permissions (including program-scoped roles), authentication. |

## 10.4 Recommended technology stack

The recommendation optimizes for the traits this system needs most: **correctness under concurrency**, **flexible dynamic forms**, **maintainability by a small institutional team**, and **modest hosting cost**.

**Primary recommendation — a TypeScript stack on PostgreSQL:**

| Layer | Choice | Why |
|---|---|---|
| **Language** | TypeScript (front & back) | One language across the stack; shared types cut a whole class of bugs — valuable for the duplicate/concurrency-critical logic. Easy to staff. |
| **Frontend** | React + **Next.js** | SSR for public/shareable program pages (correct link previews, fast first paint) and a rich SPA for admin in one framework. |
| **UI & charts** | Tailwind CSS + a data-grid/component set (e.g., shadcn/ui or Ant Design) + Recharts/Chart.js | Fast to build clean, dense admin screens (matrix, reports) and accessible forms. |
| **Backend/API** | Node.js + **NestJS** (REST/JSON) | Opinionated, modular structure maps cleanly onto the domain modules above; good testability and long-term maintainability. |
| **Database** | **PostgreSQL** | Relational integrity + DB-level unique constraints (the backbone of duplicate prevention) **and** JSONB for dynamic form schemas/responses. |
| **ORM** | Prisma (type-safe) | Type-safe queries and migrations; strong DX. |
| **Cache/queue** | **Redis + BullMQ** | Background jobs (email, QR/PDF, exports) and idempotency locks for bulk sends. |
| **Object storage** | S3-compatible (AWS S3 or **MinIO** on-prem) | Documents, QR images, certificate PDFs off the app server. |
| **Auth** | Session/JWT + RBAC, **argon2** hashing, optional TOTP 2FA for admins | Standard, secure; program-scoped roles for coordinators/operators. |
| **QR / PDF / Excel / Email** | `qrcode` · Puppeteer (HTML→PDF) or PDFKit · **ExcelJS** · Nodemailer + MJML/Handlebars | Mature libraries covering every generation/export/notification need; HTML certificate templates are configurable without code. |
| **Packaging/deploy** | Docker (+ Docker Compose), Nginx reverse proxy, CI/CD | Runs on a single institution VM; scales horizontally later. |

**When to choose an alternative instead:**

| Alternative | Best when | Trade-off |
|---|---|---|
| **Laravel (PHP) + PostgreSQL/MySQL + Inertia/Vue** | Team is PHP-oriented or hosting is constrained/shared; want batteries-included auth, queues, mail, policies. | Two languages if a JS-heavy frontend grows; still an excellent institutional fit. |
| **Django (Python) + DRF + React + Celery** | Team is Python-oriented; values Django's admin/ORM and data tooling. | Separate front-end language; admin needs customization for these dense screens. |
| **Ruby on Rails + React** | Rapid delivery, mature conventions. | Typically a smaller local hiring pool. |

All four can satisfy every requirement here; the differentiator is your **team's skills and hosting**. If those are open, the TypeScript stack is the default recommendation; if your team is PHP-first or you're on shared hosting, **Laravel** is the strongest alternative.

## 10.5 Data model overview (conceptual)

Kept high-level here by design. Core entities and relationships:

```
AcademicSession 1───* Program 1───* ProgramDay 1───* DayService(type, enabled)
                              │
   Program 1───* Form(kind: registration|feedback, [dayId?]) 1───* Question(type, configJSONB, order, required)
   Program 1───* Registration *───1 Participant
                     Registration 1───1 AnswerSet(JSONB) + projected identity columns (email/mobile)
   ProgramDay 1───* AttendanceRecord *───1 Participant          [unique: participant+program+day]
   ProgramDay 1───* FoodService 1───* FoodToken *───1 Participant [unique: participant+program+day+service]
                                        FoodToken 1───0..1 FoodClaim
   FeedbackInstance(program|day) 1───* FeedbackResponse 1───1 AnswerSet(JSONB)
   Program 1───* Certificate(number unique, status, token) *───1 Participant
   Program 1───* Document(category)
   NotificationTemplate 1───* NotificationMessage(status, recipient, trigger)
   User *───* Role *───* Permission ; Role may be program-scoped
   AuditLog(actor, entity, action, before/after, reason, ts)  — append-only
```

**Design choices:**

- **Transactional core is fully relational** (attendance, food tokens/claims, certificates) so **database unique constraints** guarantee no duplicates even under concurrent writes.
- **Dynamic parts use JSONB**: question configuration and submitted answers are JSONB, giving unlimited form flexibility, while **critical answers** (identity key, name, department) are **projected into indexed columns** for duplicate checks, filtering, and reporting.
- **Masters are referenced by FK**, keeping data clean and aggregatable for session analytics.

## 10.6 Token & QR security model

A single `ServiceToken` concept underlies attendance, food, and certificate verification:

- A token is a cryptographically random, opaque string (≥128-bit) mapped server-side to `(purpose, participant, program, day, service, status, expiry)`.
- QR codes encode only a **URL containing the token** — never participant PII.
- The server resolves the token, validates program/day/service/window, checks status, and performs the action inside a transaction.
- Single-use tokens (food, and a claimed attendance token) transition status atomically; verification tokens are read-only and public.

## 10.7 Concurrency & idempotency (critical)

This is the part most likely to bite a naïve implementation, so it is called out explicitly (source §54: "pay special attention to concurrent scanning and duplicate transactions").

- **Attendance:** unique constraint on `(participant, program, day)`. Scans use insert-on-conflict / `SELECT … FOR UPDATE`; concurrent scans from multiple gates resolve to exactly one record — the rest return "Attendance already marked."
- **Food claim:** atomic compare-and-set of token status `SENT → CLAIMED`; only one transaction wins; others get "Food already claimed."
- **Idempotent bulk send:** eligibility (`Present AND not-yet-sent`) is computed and marked **inside a transaction**, guarded by a Redis lock/queue so rapid double-clicks of "Send Food QR" process each participant once and report the true new count.
- **Certificates:** unique certificate numbers; generation is guarded so re-runs never duplicate or overwrite.
- **Notifications:** de-duplicated per `(recipient, trigger)` unless an explicit Resend is requested.

## 10.8 Security architecture

Authentication for staff/admin (with optional 2FA for elevated roles); public participant actions are token-scoped only. Authorization is **RBAC with program-scoped roles** — e.g., a Program Coordinator has full rights on their program but not others; a Food Counter Operator can only validate/claim food tokens. Every request is authorized server-side. Public endpoints (registration, verification) have rate-limiting and CAPTCHA. PII is access-controlled and redacted in exports for roles that lack PII permission. TLS in transit; encrypted backups at rest; uploaded files type/size-checked and stored outside the web root. All sensitive actions flow through the audit hook.

## 10.9 Deployment topology

For typical university load, a single VM running Docker Compose (app, worker, PostgreSQL, Redis, MinIO, Nginx) is sufficient; scaling out means separating workers and moving to managed PostgreSQL/object storage. Automated nightly database backups plus file-store backups, with a documented restore drill, satisfy the reliability NFRs.

---

# 11. Key Workflows

Workflows are shown as text flow diagrams (per the source spec). Decision points are marked; every rejection path produces a clear message and, where administrative, an audit entry.

## 11.1 Program creation (wizard)

```
Admin → New Program
  Step 1  Basic info (title, type, category, session)
  Step 2  Departments + target participants
  Step 3  Date / time / venue / duration (N days)
  Step 4  Configure days  ── auto-creates Day 1..N; toggle services per day
  Step 5  Registration form (dynamic questions)
  Step 6  Attendance config
  Step 7  Food config (eligibility rule)
  Step 8  Feedback config (single | day-wise)
  Step 9  Certificate config (eligibility rule + template)
  Step 10 Notifications (which templates, when)
  Step 11 Review complete configuration ── jump-back to fix gaps
  Step 12 Save Draft ─────────► (no full validation)
          Publish ── validate all ──► generate public link + service links
```

## 11.2 Registration

```
Open public link ► View program ► Click Register
   ► Render dynamic form (fields adapt to Internal/External)
   ► Submit ► Server validation
        ├─ invalid ──────────────► show field errors (no save)
        ├─ duplicate identity ───► "Already registered" (+ reg no.)
        ├─ capacity full ────────► block OR waitlist (per config)
        └─ ok ► create registration ► generate reg number
                 ► (approval mode? ─ yes ─► status = pending)
                 ► send confirmation (+ attendance QR)  ► done
```

## 11.3 Attendance (multi-scanner, duplicate-safe)

```
Day active AND attendance service = Active
   Operator (Gate n) scans participant attendance QR / token
   ► resolve token ► validate program ► validate day
   ► TRANSACTION: insert attendance (unique: participant+program+day)
        ├─ conflict (already present) ─► "Attendance already marked"
        └─ inserted ─► record time + gate/operator ─► "Present ✓"
   (Concurrent gates: exactly one insert wins; others see "already marked")
Manual correction (authorized): present/absent/remove
   ► require reason ► write audit (before/after)
```

## 11.4 Food QR — generate & send only new eligible

```
Admin opens Food ► "Generate & Send Food QR" (for a day/service)
   ► compute ELIGIBLE = attendance Present (per rule)
   ► compute NEW = ELIGIBLE AND Food QR Sent = No
   ► show summary:  Eligible: 85 | Already sent: 80 | New: 5
   ► [Send to 5 New Eligible Participants]
        ► LOCK (prevents double-click reprocessing)
        ► for each NEW: create unique food token ► enqueue email
        ► mark Food QR Sent = Yes  (atomic)
   ► result: Sent 5 | Failed 0
(Re-clicking later with no new present ► New: 0 ► sends to none)
```

## 11.5 Food claim (counter)

```
Participant shows food QR ► Counter operator scans
   ► resolve token ► validate program / day / service
   ► TRANSACTION: compare-and-set token SENT ─► CLAIMED
        ├─ not found / wrong program / wrong day ─► specific reject msg
        ├─ already CLAIMED ─► "Food already claimed."
        └─ set CLAIMED ─► "Food issued ✓" (record time + operator)
```

## 11.6 Feedback

```
Feedback service Active (single program-level OR per configured day)
   Participant opens feedback link ► render dynamic feedback form
   ► submit ► validate
        ├─ identified + already submitted ─► "Feedback already recorded"
        └─ ok ► store response ► update live analytics
Analytics: response count, averages, distribution, satisfaction %, comments
```

## 11.7 Certificate eligibility & generation

```
Program Completed ► Finalize attendance
   ► evaluate eligibility per rule
        (e.g., attendance ≥ 75% | ≥ K of N days | all required | reg-only)
   ► preview eligible list (admin can adjust/override, audited)
   ► Generate ► assign unique certificate number ► embed verify QR
        ► render PDF from template ► send ► record delivery
Public verification (by number/token) ► VALID | CANCELLED | NOT FOUND
```

## 11.8 Program closure

```
Completed ► close registration ► finalize attendance ► finalize food
   ► close feedback ► calculate statistics ► check certificate eligibility
   ► generate certificates ► generate program report (review/edit)
   ► upload supporting documents ► review ► Archive (read-only, reportable)
```

## 11.9 Program status lifecycle

```
Draft ─► Published ─► Registration Open ─► Registration Closed
                                   │
                                   ▼
                                Ongoing ─► Completed ─► Archived
Cross-cutting (from most states): Cancelled | Postponed | Rescheduled
Illegal transitions (e.g., Archived ─► Registration Open) are rejected.
```

---

# 12. Role & Permission Matrix

Roles: **SA** = System Administrator · **PA** = IQAC/Program Admin · **PC** = Program Coordinator (scoped to assigned programs) · **AO** = Attendance Operator · **FO** = Food Counter Operator · **V** = Viewer/Reporting.
Legend: ✓ = allowed · ▲ = allowed, scoped to assigned program(s) · — = not allowed.

| Capability | SA | PA | PC | AO | FO | V |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| Manage users, roles & permissions | ✓ | — | — | — | — | — |
| Manage master data | ✓ | ✓ | — | — | — | — |
| Manage academic sessions | ✓ | ✓ | — | — | — | — |
| Create / configure programs (wizard) | ✓ | ✓ | ▲ | — | — | — |
| Publish / change program status | ✓ | ✓ | ▲ | — | — | — |
| Build registration / feedback forms | ✓ | ✓ | ▲ | — | — | — |
| Manage links & QR | ✓ | ✓ | ▲ | — | — | — |
| View participants & status matrix | ✓ | ✓ | ▲ | ▲* | ▲* | ▲ |
| Edit registration / approve / waitlist | ✓ | ✓ | ▲ | — | — | — |
| Capture / correct attendance | ✓ | ✓ | ▲ | ▲ | — | — |
| Generate & send food QR | ✓ | ✓ | ▲ | — | — | — |
| Validate / claim food at counter | ✓ | ✓ | ▲ | — | ▲ | — |
| Configure & view feedback + analytics | ✓ | ✓ | ▲ | — | — | ▲ |
| Configure certificate rules & generate | ✓ | ✓ | ▲ | — | — | — |
| Cancel / revoke certificate | ✓ | ✓ | — | — | — | — |
| Manage program documents | ✓ | ✓ | ▲ | — | — | — |
| Run reports & Excel export | ✓ | ✓ | ▲ | — | — | ▲ |
| Export PII columns | ✓ | ✓ | ▲ | — | — | — |
| View dashboards (admin/session) | ✓ | ✓ | ▲ | — | — | ✓ |
| View audit log | ✓ | ✓ | ▲ | — | — | — |

\* Operators see only the minimal confirmation data needed to do their job, not full PII.

---

# 13. Screen / Page Inventory

Grouped by area (concise, at high-level design depth).

**Public (no login, link/token based)**

- Program public page (`/p/{slug}`)
- Registration form (`/p/{slug}/register`) + confirmation
- Feedback form (`/p/{slug}/feedback` or day-scoped)
- Certificate verification result page
- Standard states: registration closed, feedback closed, program cancelled/postponed

**Admin — global**

- Login (+ optional 2FA)
- Admin dashboard (current session, program pipelines, stats, quick actions)
- Academic sessions list & detail
- Master data management (per master)
- Global program search / list
- Program creation wizard (12 steps)
- Annual IQAC dashboard (session analytics)
- Users, roles & permissions
- Global audit log
- Notification templates

**Admin — per-program workspace**

- Overview (summary counters)
- Registration (settings, list, approvals/waitlist)
- Participants + **Status Matrix** (filters, bulk actions)
- Attendance (day-wise capture, manual correction)
- Food (eligibility, generate/send, claim monitor, statuses)
- Feedback (config, responses, analytics/charts)
- Certificates (rules, eligibility preview, generate, verify/cancel)
- Documents
- Reports (report type → filters → column select → preview → export)
- Links & QR
- Settings (edit configuration / re-enter wizard)
- Program audit log
- Program report generator

**Scanner (mobile PWA)**

- Attendance scan (select gate/day, camera scan, result)
- Food claim scan (select counter/day/service, camera scan, result)
- Manual lookup fallback

---

# 14. Implementation Phases & Roadmap

Phased so that something usable ships early and the correctness-critical parts get dedicated attention.

| Phase | Focus | Delivers |
|---|---|---|
| **P0 — Foundation** | Project setup, auth/RBAC, master data, academic sessions, audit skeleton, CI/CD, DB baseline. | Secure shell + reference data; users can log in and manage masters/sessions. |
| **P1 — Programs & Registration** | Program entity + status, creation wizard, program days/services, **dynamic form engine**, public link, registration + duplicate/capacity/waitlist, confirmation email. | An admin can create a program end-to-end and collect registrations via a unique link. |
| **P2 — Attendance & Food** | Day-wise attendance (multi-gate, duplicate-safe), attendance tokens, food eligibility, **idempotent send-only-new**, single-use claim, status separation, scanner PWA, concurrency hardening. | The operational core: scan attendance, issue and claim food safely. |
| **P3 — Feedback & Certificates** | Feedback (single/day-wise) + analytics, certificate rules/generation/verification/cancellation, templates. | Post-event value: feedback insight and verifiable certificates. |
| **P4 — Reporting, Analytics & Closure** | Configurable reports + column-select Excel export, admin/program/annual dashboards, program report generator, closure & archive. | Full reporting and the annual IQAC picture; clean program closure. |
| **P5 — Hardening & Handover** | Test coverage of critical workflows (esp. concurrency), accessibility/responsive polish, docs, backups/restore drill, UAT fixes. | Production-ready, tested, documented system. |

The **participant status matrix** is built incrementally, gaining columns as each service module (P1→P3) lands, so it is always an accurate live view of whatever is configured.

---

# 15. Acceptance Criteria

The system is accepted when all of the following are demonstrably true (restated from source §55 as a verifiable checklist):

1. An admin can create a program **without developer intervention**.
2. An admin can configure **any number** of program days.
3. Services can be enabled/disabled **independently per day**.
4. Every program gets a **unique shareable link**.
5. Every program can have **different registration questions**.
6. Every program can have **different feedback questions**.
7. **Multiple question types** are supported.
8. Attendance works **day-wise**.
9. **Duplicate attendance is prevented.**
10. **Only present/eligible** participants receive food QR.
11. **Repeated food-QR sending is prevented.**
12. **Late** eligible participants can still receive food QR.
13. Food can be **claimed only once**.
14. Feedback can be **single or day-wise**.
15. Certificate eligibility is **configurable**.
16. Participant status is visible in **one centralized matrix**.
17. Reports can be **filtered**.
18. Admin can **select columns** before Excel export.
19. Program **documentation** can be stored.
20. Programs remain available for **historical analysis**.
21. Academic-session analysis works **April–March**.
22. Important administrative actions are **audited**.
23. Different programs can run with **completely different configurations**.
24. **No program-specific coding** is required.
25. The system remains usable for **small and large** programs.

---

# 16. Open Questions for Discussion

To finalize the plan and start P0/P1, these are the decisions I most need from you. Recommended defaults are in Section 9.2; unless you prefer otherwise, I'll proceed on those.

1. **Attendance identity (O-2):** Confirm attendance QR issued at registration + manual lookup fallback — or do you use ID cards / another method?
2. **Participant login (O-1):** Confirm token/link-only for v1 (no participant accounts).
3. **Notification scope (O-3, O-11):** Email-only for v1? Which SMTP/email provider, and do you need SMS/WhatsApp soon?
4. **Approval & waitlist (O-8, O-9):** Default auto-approve with per-program approval mode, and manual waitlist promotion — acceptable?
5. **Feedback anonymity (O-7):** Default to identified feedback (with anonymous option)?
6. **Certificates (O-10):** Can you share a sample certificate design, signatory names/titles, and logo assets?
7. **Privacy (O-6):** Any institutional data-retention/consent requirements (DPDP Act 2023) to bake in?
8. **Hosting (O-11):** Cloud or on-prem VM? Existing domain for the public links?
9. **Team & stack:** Any existing tech-stack preference/skills? This decides TypeScript vs. Laravel vs. Django (Section 10.4).
10. **"Quiz" service (O-12):** In scope for v1, or defer beyond a simple placeholder?

Once these are settled, the next deliverable would be the detailed data model (full ERD) and the P0/P1 build plan.

---

*End of document — v0.1 draft for review.*
