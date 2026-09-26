# IQAC PMS — Manual Test Guide (Full Workflow)

> **IQAC PMS** — Internal Quality Assurance Cell · Programme Management System
> Version 1.0 (Sept 2026) · Roles: **SA / PA / PC / AO / FO / V**
>
> | Item | URL |
> |------|-----|
> | Admin console (React) | `http://localhost:5173` |
> | API | `http://localhost:8000/api/v1` |
> | Swagger UI | `http://localhost:8000/api/docs/` |
> | ReDoc | `http://localhost:8000/api/redoc/` |
> | Admin login | `admin@university.edu` / `Admin@12345` (role **SA**) |

This guide walks a human tester through **every screen and every minor detail** of the
system, end to end: setup → program wizard → public registration → attendance → food →
feedback → certificates → notifications → reports → closure/archive. Use the checkboxes
to tick off each step. Expected results are written as **→ expected**.

> Note: A program `DEEKSHARAMBH — Students Induction Programme (SIP), 2026` already
> exists in the local DB and can be reused, but the guide below creates a fresh one to
> cover every code path.

---

## 0. Before you start

- [ ] Backend is running: `python manage.py runserver 0.0.0.0:8000 --noreload` (backend dir).
- [ ] Frontend is running: `npm run dev` (frontend dir, Vite on port 5173).
- [ ] `backend/.env` exists with `SECRET_KEY` set; `DEBUG=True` is fine for testing.
- [ ] `.env` has `FRONTEND_URL=http://localhost:5173` and `PUBLIC_SITE_URL=http://localhost:5173`
      (so Links & QR and email links point to the frontend, not `127.0.0.1`).
- [ ] Have open: Browser tab 1 (admin), tab 2 (anonymous/incognito for public pages),
      and optionally Swagger `http://localhost:8000/api/docs/`.

**Rules of thumb while testing**

- Public endpoints are **throttled**: public registration & feedback = **10/min per IP**,
  public reads 60/min. Rapid retries → 429. Slow down between tests.
- All `setState`/load-toast errors surface as a red banner with `{code, message}`.
- Emails (registration confirm, food QR, certificates): SMTP creds are often blank, so
  sending **fails silently** — the API returns a `confirmation_email` **preview** and
  `confirmation_sent:false` instead. This is expected, not a bug. Never breaks the flow.
- Long jobs (certificates, reports, notification batches) run **inline** on this setup
  (`CELERY_TASK_ALWAYS_EAGER`), so they complete before the response returns.

---

## 1. Login, 2FA, Users, Audit

### 1.1 Login
- [ ] Open `http://localhost:5173` → redirected to `/login`.
- [ ] Enter `admin@university.edu` / `Admin@12345` → **Sign in** → **→** lands on `/programs`.
- [ ] Wrong password → red error toast (401), stays on `/login`.
- [ ] Audit check: `Audit` page → filter Action = `login` → **→** a `login` entry exists
      with email + `login_ip` captured. (No password-reset test — reset is a stub.)

### 1.2 Two-Factor Authentication (optional but covers the path)
- [ ] `Account > Security` → **Enable 2FA** → **→** shows QR + secret.
- [ ] Scan into Google Authenticator (issuer *"IQAC PMS"*), enter the 6-digit code, enable
      (audit `2fa_enable`).
- [ ] Log out → log in → **→** step 2 "Two-factor code" appears → enter code from
      authenticator → **Verify & sign in** → land on `/programs`.
- [ ] `Security` page → **Disable 2FA** with current code (audit `2fa_disable`).

### 1.3 Users & roles (`/users`, SA only)
- [ ] Create user: **Username**, **Email**, **First name**, **Last name**, role (try `AO`),
      **Password** + **Confirm password**, Active ✓ → **→** saved, audit `create`.
- [ ] Edit, **Activate/Deactivate**, **Delete** each work; table search filters.
- [ ] Role gates: a user with no program assignment gets **empty Programs/Food/etc. lists**
      (scoped). Assign them via SA **Program Assignments** to change this (Part N).
- [ ] Audit page: filter by **Actor / Role / Entity / Action / program / date range** → entries
      appear for user create/update/delete.

---

## 2. Prerequisite master data & academic session

- [ ] `Master Data` → add a **Program type** (e.g. `FDP`), an **Academic department**,
      an **Administrative department**, a **Designation**, and a **Venue** (try one with city
      + capacity filled in — the venues table shows these columns).
- [ ] Activate/deactivate one master item → **→** it appears/disappears from the wizard
      dropdowns (`active` lists). Try leaving ONE item inactive and confirm the wizard can't
      see it.
- [ ] `Sessions` (`/sessions`) → create an **Academic session** (e.g. `2025-26 / Even
      Semester`, with start/end dates) → **Activate** it. **The wizard requires an academic
      session; without one the Basics step has nothing to select.**

---

## 3. Program Wizard (`/programs/wizard`) — create a fresh program

### Step 1 — Basics
- [ ] **Program title*** `e.g. "FDP on AI in Higher Education"`; **Short code*** `e.g. FDP-AI-2026`.
- [ ] **Academic session***  ← select the session from Part 2.
- [ ] **Description** (rich text editor — type a few lines, add bold).
- [ ] **→** `Next`.

### Step 2 — Organisation
- [ ] **Program type***, **Organising department type*** = `Academic departments`.
- [ ] **Organising departments*** MultiSelect — pick 1–2.
- [ ] **Venue** (pick the venue; then switch to **"No venue"** once to see the placeholder
      change to *"Venue name / address"*), **Venue details**.
- [ ] **Bonus check**: change "Organising department type" to `Administrative departments`,
      select one, then switch **back** to Academic and keep an admin dept selected → **→**
      toast *"Administrative departments were removed from Organising departments…"*.
- [ ] **→** `Next`.

### Step 3 — Schedule
- [ ] **Start date** = today, **End date** = start + 2 days → **Number of days** auto/default 1 →
      set it to **3**. **Start time** `09:30`, **End time** `17:00`. **→** Next.

> **Minor detail**: on `Next` from this step the program is **created** (audit `create`), the
> 3 `ProgramDay` rows are auto-generated, and the URL changes to `/programs/wizard/{id}`
> (replace navigation). A "Save progress" button appears in the bottom bar from here on.

### Step 4 — People
- [ ] **Program coordinator*** (user dropdown). **→** Next.

### Step 5 — Capacity
- [ ] Test **both** modes: first leave **Max participants** blank (= unlimited), then change to
      `3` (so we can also test the waitlist later). **Registration approval** = `Require approval`.
      **→** Next.

### Step 6 — Content
- [ ] Fill **Objective**, **Expected outcomes** (rich text). **→** Next.

### Step 7 — Registration Form
- [ ] **"+ Add standard fields"** → adds Full Name(text,req), Email(email,req),
      Contact No.(phone,req), Department(select), Designation(select). **→** these appear.
- [ ] **"+ Add field"** → add a custom field: type `radio`, label `How did you hear about
      this?`, options `WhatsApp,Email,Colleague`, not required. Then **Remove** it (covers delete).
- [ ] Confirm first field shows the **Required** tick. **"Save registration form"** →
      toast/`Saved`. (The form preview in Public Register reflects this schema later.)
- [ ] **→** Next.

### Step 8 — Feedback Form
- [ ] Add fields, e.g. `overall_rating` radio `1..5`(req) + `comments` longtext.
      **"Save feedback form"**. **→** Next.

### Step 9 — Days & Services
- [ ] **→** 3 day cards `Day 1/2/3` appear, each with date auto-filled from Start date.
- [ ] For each day: set a **Title (optional)**; enable **Attendance** and **Food** checkboxes;
      set start/end time if needed.
- [ ] **Resource person(s)** → **+ Add person** on Day 1 → Name*, Designation, Institution,
      Email, Phone.
- [ ] Remove a resource person then re-add (covers diffing).
- [ ] Try **Remove** Day 3 then re-add it via... note: days are diffed against `number_of_days`
      — if you remove a day, save, then set Number of days back up the day is recreated. Cover
      this lightly; final state must be **3 days, attendance+food enabled on all**.
- [ ] **"Save days"**. **→** Next.

### Step 10 — Review
- [ ] **→** Review reads back: Title, Short code, Session, Type, Organising dept, Venue, Dates,
      Days, Coordinator, Max participants.
- [ ] **Finish** → lands on `/programs`; new program visible in the list with status **DRAFT**.

---

## 4. Status lifecycle + Links & QR page

### 4.1 Lifecycle (use `Program` detail page buttons, or status API)
- [ ] DRAFT → **Publish** → PUBLISHED.
- [ ] PUBLISHED → **Open registration** → **REG_OPEN**.
- [ ] **Invalid transition** (belt & braces): from REG_OPEN try `POST /programs/{id}/status/`
      with `{"to":"PUBLISHED"}` → **→** 409 `{"code":"CONFLICT", …}`.

### 4.2 Links & QR (`/programs/{id}/links`)
- [ ] **Public links**: Program page / Registration / Feedback each show a URL AND an ON/OFF
      toggle. **Critical check** → the URLs now read
      `http://localhost:5173/p/{token}/`, `.../register/`, `.../feedback/`
      (**not** `127.0.0.1`). See Part 4.3 for the fix note.
- [ ] Click the **Program page** link in a new tab → **→** the public `/p/{token}` page renders.
- [ ] **Toggle OFF** Registration → toast *"Registration link disabled"*.
      Open the public page → **Register button** disappears/disabled ("Registration closed").
      Toggle back **ON**.
- [ ] QR cards (Program/Registration/Feedback) render PNGs. Scan one with a phone →
      opens `localhost:5173/p/...` (works on the same LAN/port as the dev server).
- [ ] **Regenerate token** (confirms "type `delete`") → **→** toast *"Public token regenerated"*;
      all three links/QRs now show a **new token**; the old `/p/{old}/` URL → 404 page.
- [ ] **Closure readiness** card shows 6 checks + blockers (see Part 13 for final closure).

> **Root-cause of the old 127.0.0.1 bug (fixed)**: Vite proxies `/api` to
> `127.0.0.1:8000` with `changeOrigin`, so the backend saw Host `127.0.0.1:8000` and built
> links via `request.build_absolute_uri`. The serializer now prefers `FRONTEND_URL` /
> `PUBLIC_SITE_URL` from `.env` (both `http://localhost:5173`). QRs encode the same fixed URLs.

---

## 5. Public registration (`/p/{token}/register` — incognito tab)

### 5.1 Happy path
- [ ] Open the Registration link/QR from Part 4.2. **→** form shows the saved schema
      (standard fields + custom ones) with the block-level validation rules.
- [ ] Fill **Full Name**, **Email**, **Contact No.**, **Department**, **Designation** (+ custom).
- [ ] Submit → **→** success panel shows the **registration number** prominently, e.g.
      `FDP-AI-2026-0001`, status (SUBMITTED — approval required), and an `attendance_token`.
- [ ] Copy the registration number + the participant's email for later (My QRs, self check-in).
- [ ] Swagger/admin: `Registrations` list shows the row with status **SUBMITTED**.

### 5.2 Validation & edge cases
- [ ] Submit empty email AND mobile → **→** 400 `VALIDATION` "Email or mobile required".
- [ ] Submit with a required field blank → **→** 422 `VALIDATION_ERROR` +
      highlighted field errors (`"{label} is required."`).
- [ ] Submit a radio with an option not in the list → **→** invalid-option error.
- [ ] Duplicate: same email again → **→** 409 `DUPLICATE` "Already registered"
      (returns existing `registration_number` + `status`).
- [ ] **Waitlist**: with max=3 from Step 5, register until approved-count ≥ 3 → **→** 4th/5th
      get status **WAITLISTED**.

### 5.3 Approval flow (admin)
- [ ] `Participants > Registrations` (or via program detail) select a SUBMITTED row →
      **Approve** → **→** status APPROVED, audit entry.
- [ ] Approving an already-APPROVED row → **→** 409 `Cannot approve: status is …`.
- [ ] **Reject** one with a reason → rejected. **Cancel** one → cancelled.
- [ ] **Waitlist promotion**: with an approved slot a WAITLISTED row can be promoted
      (POST registers `promoted_by/at`, clears `waitlist_position`).
- [ ] Confirmation email: read `confirmation_email` in the register response or check the
      console log — body contains program title, venue, registration number and the **My QRs
      link** (`{PUBLIC_SITE_URL}/my-qrs`).

---

## 6. My QR Codes (`/my-qrs`)

- [ ] Open `/my-qrs` (incognito). Enter **registration number** + the **email** used → **Show
      my QR codes**.
- [ ] **→** participant name/email card + per-program card: `short_code`, title,
      `Registration: {no} · Status: {status}`.
- [ ] **Attendance QRs**: one per attendance-enabled day (`Day N · {date}`), labelled
      *"Show at the attendance counter."*. The QR encodes the registration `attendance_token`
      — same token for all days.
- [ ] **Food QRs**: only for **active** food services on **food-enabled** days (none yet — add
      in Part 8, then re-open this page). Badges: **Unclaimed** (green) / **Already claimed**
      (red).
- [ ] Wrong registration number/email combo → **→** 404 "No matching registration…"; missing
      field → 400 `VALIDATION`.

---

## 7. Attendance

### 7.1 Attendance sessions & gates (setup before marking)
- [ ] `Attendance` UI or API: create an **AttendanceSession** for the program (status
      SCHEDULED) → **Open** it → **→** status ACTIVE, `expected_participants`
      = APPROVED+SUBMITTED count.
- [ ] Create a **gate** (e.g. `Main Gate`).

### 7.2 Manual mark (`/attendance`)
- [ ] On Attendance page pick the program + **Day 1** → roster/search lists APPROVED
      participants.
- [ ] Mark a participant present → **→** row is marked; roster shows `is_present:true`,
      `scanned_by` = you; `source` = MANUAL.
- [ ] Mark the **same participant again** same day → **→** idempotent `already_marked`
      (200) — no duplicate row (unique per participant-day).
- [ ] Mark a participant who is NOT approved → **→** 403 "Participant not registered
      or not approved".
- [ ] Switch to a day where Attendance was **not enabled** (none in our program yet — you can
      disable on wizard) → **→** 409 "Attendance not enabled for this day".
- [ ] Edit / **Delete** a record (delete confirm dialog); `Participant override` API toggles
      `is_corrected=True` + reason (listed on attendance correction flows).

### 7.3 Self check-in page (`/p/{token}/attendance`)
- [ ] Open the day's **self-QR** (Attendance page has a self-QR action per day) or navigate to
      `/p/{token}/attendance/?day={day_id}`.
- [ ] Enter **Registration number** + **Email** → Submit.
- [ ] **First time** → **→** "✅ Attendance confirmed!" + Participant name + `Day N — title`.
- [ ] **Again** → **→** "☑️ Already marked".
- [ ] Wrong reg/email → format/not-found error; empty → "This field is required."

### 7.4 Scanner page (`/food/scan` — tabs "Attendance" / "Food")
- [ ] Camera unavailable (desktop) → **→** fallback text *"Camera not available on this browser.
      Use manual entry below."*
- [ ] Switch to **Attendance** tab; phone with the participant's attendance QR (Part 6) →
      scan → marked; re-scan → already marked.
- [ ] Day stats: `total_expected / present / absent / late / attendance_rate`.
- [ ] Mark one participant **late** on Day 2 (is_late flag).

### 7.5 Status Matrix (`/participants/status`)
- [ ] Pick the program → **→** per-participant grid across days: attendance
      `{present,late}`, food `{eligible, qr_sent, claimed}`, feedback `{submitted}`, certificate
      `{status, number}`.
- [ ] Export → `{job_id}` queued (inline) → download file.

---

## 8. Food services (per day)

### 8.1 Configure a service (Food page)
- [ ] `Food` → pick program → **Add service**. Fields: **Day*** (e.g. Day 1), **Service type***
      = `LUNCH`, **Name** = `Lunch Day 1`, **Service time**, **Eligibility rule**, **Active** ✓.
- [ ] `Rule type` options to test (label → behaviour):
  - **All registered participants** (`registration_only`) — everyone APPROVED/SUBMITTED.
  - **Present that day (attendance)** (`attendance_present`) — only participants **marked
    present on that day** (default when rule is absent).
  - **Attendance % (min days)** (`attendance_percentage`) — shows an extra **"Min attendance
    %"** number field; eligible if distinct present days ≥ `max(1, round(days × %/100))`.
  - **Present on previous day** (`previous_day_present`) — present on day-1.
- [ ] Create **one service per day** for all 3 days, on day 2 use `attendance_percentage`
  (50%), on day 3 use `present on previous day` — covers all four rule types.
- [ ] **Missing-field guard**: **Create** is disabled until a **Day** is picked.

### 8.2 Eligibility → generate → preview → send (Day operations panel)
- [ ] In **Day operations** pick Day 1 → stats appear: `Eligible / New / Already sent /
      Claimed / Pending`. With no days of attendance yet and rule `registration_only`,
      **Eligible = registered count**, New = same.
- [ ] **Generate QR codes** → **→** "Generating…" → per-service token generation; count in the
      stats updates; a second click is **idempotent** (no duplicate tokens).
- [ ] **Preview send summary** → `eligible / already_sent / new_to_send`.
- [ ] **Send to new eligible** → **→** "Sending…" → Sent count grows; re-run sends only
      *newly eligible* (idempotent). (Emails fail silently → but the flows keep working.)
- [ ] Confirm tokens exist: `Food tokens` list (Swagger `/food/tokens/?food_service=`) shows
      one token per eligible participant with email flags.

### 8.3 Claim (single-use)
- [ ] Get a participant's Day-1 food QR from **My QRs** (Part 6) OR from `/food/tokens`.
- [ ] **Food tab** of the scanner → scan (or manual entry of the token) → **→** success
      "Food issued" + participant name; `FoodClaim` recorded with gate + device info.
- [ ] **Scan the same QR again** → **→** 409 "Food already claimed"; My QRs badge flips to
      **Already claimed** immediately.
- [ ] Wrong-program QR → 403 "QR is for a different program"; wrong-day → "QR is for a
      different day"; invalid token → 404 "Invalid QR code".
- [ ] Summary: totals per service — `eligible, generated, sent, claimed,
      remaining_to_claim, new_eligible_not_sent`.

### 8.4 Attendance-gated rule (prove the rule engine)
- [ ] Day 2 uses `attendance_percentage 50%` → with 3 program days a participant marked
      present on ≥ `round(3×50/100)=2` days is eligible; one present <2 days is **not**
      eligible.
- [ ] After adding attendance on Day 1–3 (Part 7), re-run **Generate** on Day 2 → **→** only
      the ≥2-days participants appear as eligible/generated.

---

## 9. Feedback

### 9.1 Create + activate (Feedback page)
- [ ] `Feedback` → pick program → create **Title*** e.g. `Day 1 Feedback`, **Day** (or
      PROGRAM scope), **Anonymous**, **Allow multiple** → Save → **Activate** → **→** an
      instance token is revealed; status ACTIVE.
- [ ] A second instance can be left in SCHEDULED/closed state (for the closure check).

### 9.2 Public submit (`/p/{token}/feedback`)
- [ ] Open the feedback link/QR → **→** one or more active forms; an empty state otherwise
      *"There are no active feedback forms…"*.
- [ ] Submit with valid `answers` (matching the schema from wizard Step 8) + your
      registration number → **→** 201 "Feedback submitted successfully".
- [ ] Required field missing / invalid option → **→** 422 `VALIDATION_ERROR` + field errors.
- [ ] Re-submit when `allow_multiple` = off → **→** blocked/duplicate handling.
- [ ] Submit as **anonymous** → **→** response recorded with no participant link.

### 9.3 Analytics (admin)
- [ ] Feedback page → select the instance → **→** response count, response rate, per-question
      distribution, and the comments list.

---

## 10. Certificates

> UI: the **Certificates** page shows the config summary + the certificate list, but the
> **config is created via API/Swagger** (`PUT /api/v1/certificates/program/{id}/config/`).
> Templates:
> `POST /api/v1/certificates/templates/` with `{name, html_template, page_size, orientation}`.

- [ ] **Create a template** (Swagger) e.g. `Workshop CoE`,
      `html_template` containing `{{participant_name}}`, `{{program_title}}`, `{{certificate_number}}`.
- [ ] **Configure** (`PUT .../config/`):
      `{"template":"<id>","eligibility_rule":{"type":"registration_only"},
       "certificate_prefix":"FDPAI","start_number":1}` → **→** returns
      `{certificate_prefix:"FDPAI", current_number:1, require_manual_approval:true, ...}`.
- [ ] Certificates page → program → **→** config stats now visible (Prefix FDPAI, Current 1,
      Manual approval Yes).
- [ ] **Eligible** check (`GET .../eligible/`) → **→** each participant `is_eligible:true`,
      `basis.rule:"registration_only"`, `has_certificate:false`.
- [ ] **Generate** (`POST .../generate/`) → **→** `{job_id, message:"Certificate generation
      queued"}`; list shows `FDPAI-000001…` status **PENDING** (because manual approval is on).
- [ ] **Manual approval**: approve the pending records → status **GENERATED**; each has
      `verification_token`, `verification_url`, `pdf_file`.
- [ ] **Public verify**: open the `verification_url` (the system certificate verify page
      `/verify?ref=...`) → **→** green "Certificate verified ✅" with Status, Issued to,
      Program, Program dates, Issued by, Issued on.
- [ ] **Invalid number** → **→** "Certificate not found" ⚠️ (red).
- [ ] **Download PDF** (`/public/certificates/{token}/download/`).
- [ ] **Send** (`POST .../send/`) queues emails (silently fine); use **Resend** on a row.
- [ ] **Cancel** a certificate (confirm) → status CANCELLED; second cancel → **→** 409; the
      public verify/download for it → 410 GONE / invalid.
- [ ] Override rule check: create a config with
      `{"type":"attendance_percentage","min_percentage":75}` and confirm only those with
      ≥75% attendance appear eligible.

---

## 11. Notifications

- [ ] `Notifications` → pick **Program** (required) → **Title**, **Body**, **Channel** (EMAIL
      default), **Trigger** (select a template trigger to autofill title/body from the
      template picker).
- [ ] **Send notification batch** → **→** toast with `batch_id`; batch status QUEUED then
      SENT (inline execution).
- [ ] Participants = all **APPROVED/SUBMITTED** for the program (subtitle hint confirms).
- [ ] Send to a program with **no** matching participants → **→** 400 `EMPTY`
      "No matching participants".
- [ ] **Bell dropdown** (topbar) → **→** last 4 batches with program/template/status +
      pending count; "No notifications yet." when empty; **View all** → Notifications page.
- [ ] Placeholders render: verify `{{participant_name}}`, `{{program_title}}`,
      `{{registration_number}}` from the template render into messages.

---

## 12. Reports & Documents

### 12.1 Reports (`/reports`)
- [ ] Pick a **Report type** (REGISTRATION, ATTENDANCE, FOOD, FEEDBACK, CERTIFICATE,
      PARTICIPANT_STATUS, COMPLETE_PROGRAM, DEPARTMENT_WISE, ACADEMIC_SESSION, CUSTOM).
- [ ] **Format**: `xlsx` (default) / `csv` / `pdf`.
- [ ] **Columns** catalog with checkboxes (defaults preselected) → deselect one.
- [ ] **Generate export** → **→** export row appears → download produced file (PENDING→READY).
- [ ] Filters JSON panel guards invalid JSON.

### 12.2 Documents (`/documents`)
- [ ] Category default **CIRCULAR** (options: CIRCULAR, POSTER, PERMISSION_LETTER,
      RESOURCE_PERSON_PROFILE, PRESENTATION, ATTENDANCE_EVIDENCE, PHOTOGRAPHS, FEEDBACK_REPORT,
      PROGRAM_REPORT, CERTIFICATE_TEMPLATE, OTHER).
- [ ] Upload a file (≤10 MB; allowed `pdf,doc,docx,xls,xlsx,jpg,jpeg,png`) with Title →
      appears in table. Oversized/wrong type → rejected.
- [ ] Edit / Delete a document. (**Documents are a closure blocker** — upload at least one.)

---

## 13. Closure & archive

- [ ] Drive the program to **COMPLETED**: REG_CLOSED → ONGOING → COMPLETED
      (status API / detail-page buttons as per Part 4).
- [ ] `Programs > {program} > Links & QR` → **Closure readiness** → **→** six checks:
      Registration closed, Attendance finalized, Food finalized, Feedback closed, Certificates
      handled, Documents uploaded. With everything in place → **→** green `can_close:true` with
      zero blockers.
- [ ] Deliberately leave **feedback open** (an ACTIVE instance) → **→** blocker
      *"Feedback instances still active"* and **Close** disabled.
  - Do this check fast, then close/delete the active instance.
- [ ] Close **documents/attendance/food** blockers individually and watch each check flip.
- [ ] **Close & archive program** (danger confirm, type the magic word) → **→** success;
      status **ARCHIVED**.
- [ ] Post-archive: status chip = ARCHIVED; public registration page shows closed; feedback
      trips its closed state; no further status transitions possible (ARCHIVED not in
      `VALID_TRANSITIONS`).

---

## 14. Role-scoped matrix (the big one)

Create one user per role (Part 1.3) and log in as each; verify **only** the intended
privileges:

| Role | Scope / expectation |
|------|---------------------|
| **SA** | Users, Audit, Master Data, everything. |
| **PA** | Program Admin — programs, master data (add/edit), programs lists for scoped programs. |
| **PC** | Program Coordinator — program create/edit/wizard, feedback, certificates, notifications, reports. |
| **AO** | Attendance only — mark/scan, sessions & gates; **no** food/certs/users pages. |
| **FO** | Food only — services, eligibility, generate/send, claims/scanner. |
| **V**  | Viewer/reporting — lists, dashboards, reports; **no** create/edit actions. |

- [ ] Log in as an **operator** with NO program assignment → **→** empty scoped lists.
- [ ] SA → **Program Assignments** → assign AO to the test program → **→** operator now sees it.
- [ ] Verify a **PC** cannot open Users (SA-only) and a **V** cannot edit a program.

---

## 15. End-to-end smoke checklist (do in one sitting, fresh program)

1. Setup: master data + active session.
2. Wizard save → DRAFT. 2.5 Publish → Open registration.
3. Links page: `localhost:5173` URLs ✅ (not 127.0.0.1), QR scans.
4. Register 3 people in incognito (approval required) → SUBMITTED.
5. Approve 2, reject 1, waitlist 1 (max 3).
6. My QRs shows attendance QRs per day (+ food once services exist).
7. Open attendance session + gate; mark Day 1 all 3 approved.
8. Food: add 3 services (different rule types) → generate → send → claim 1 → re-scan gives
   "already claimed".
9. Feedback: activate → submit 2 responses → analytics.
10. Certificates: template + config → eligible → generate → approve → verify page → download.
11. Notifications batch → bell shows batch.
12. Report export (xlsx) → download. Upload ≥1 document.
13. Status: REG_CLOSED → ONGOING → COMPLETED → closure readiness all green → **Archive**.
14. Post-close: public page closed; verify certificate still verifies.

---

## 16. Known gotchas & open items (test-aware)

- **Draft-delete bug**: deleting a non-DRAFT program → HTTP 500 (bare exception). Test delete
  only on a DRAFT program.
- **Public registration throttle** 10/min/IP → slow tests down; a 429 is not an app error.
- **Duplicate registration** is 409 unless prior row is CANCELLED/REJECTED (those are replaced).
- **Food claim concurrency**: single success per token (DB `select_for_update`) — fire two
  parallel scans and expect exactly one "claimed".
- **Attendance**: one record per participant-day; re-marking is idempotent `already_marked`.
- **Emails**: with blank SMTP creds everything still works but no mail is delivered; the
  register response carries the message preview.
- **Status transitions are asymmetric** (e.g. REG_CLOSED → ONGOING ok; ONGOING → POSTPONED not)
  — assert each arrow you care about.
- **Links & QR fix** (this session): `FRONTEND_URL`/`PUBLIC_SITE_URL` set to
  `http://localhost:5173` in `backend/.env`; program link serializers prefer them over the
  request host. Restart the backend after `.env` edits.

---

## Appendix — quick API login snippet

```powershell
$base = "http://localhost:8000/api/v1"
$login = Invoke-RestMethod -Method Post -Uri "$base/auth/login/" `
  -ContentType "application/json" `
  -Body '{"email":"admin@university.edu","password":"Admin@12345"}'
$h = @{ Authorization = "Bearer $($login.access)" }
# Program links (uses configured frontend URL)
Invoke-RestMethod -Method Get -Uri "$base/programs/<program-id>/link/" -Headers $h
```