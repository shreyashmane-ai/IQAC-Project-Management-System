# CAMPUSTO — "Campus to Community" End-to-End Workflow Test

> **IQAC PMS** — Internal Quality Assurance Cell · Programme Management System
> Version: **1.0** (Sept 2026) · Roles: **SA / PA / PC / AO / FO / V**
> URLs — Admin console: `http://localhost:5173` · API: `http://localhost:8000/api/v1`
> OpenAPI: `http://localhost:8000/api/docs/` (Swagger) / `http://localhost:8000/api/redoc/`
> Admin login: `admin@university.edu` / `Admin@12345`
> Full project reference: `docs/PROJECT-REFERENCE.md`

> Verified against the live API at `http://127.0.0.1:8000/api/v1` on **2026-08-30**.
> Program: **CAMPUSTO** (short_code `CAMPUSTO`, id `7d85c841-322e-41e3-980c-f36a7ee0aa88`),
> 3 days (2026-09-01 → 2026-09-03), status **ARCHIVED** at completion.
> Auth used: `admin@university.edu` (role `SA`, JWT bearer).

This document records **every HTTP call** of a full 3-day program run
(program setup → public registration → attendance → food → feedback →
certificates → status lifecycle), capturing the request payload and the
actual API response. All end-state data is as returned by the running server.

---

## Reference IDs

| Item | Value |
|------|-------|
| Program id | `7d85c841-322e-41e3-980c-f36a7ee0aa88` |
| Public token | `0q9zrz_hFnz8pmOxC7RCElGhAw6FKztvnUfNVVzD5Hk` |
| Feedback instance id | `2126958c-4b5c-4205-aa18-4760e6c27d4d` |
| Day 1 | `4516e5ad-3558-4720-90c9-be7e62352be1` |
| Day 2 | `3eaee860-ef6e-41c6-ac75-4d148ec5005b` |
| Day 3 | `6285ac6f-efd0-48c9-9bb5-bbb1aa4aabe2` |

### Participants (via `GET /participants/registrations/?program=<id>`)

| # | Registration | Name | Email | Status |
|---|--------------|------|-------|--------|
| 1 | CAMPUSTO-0004 | Sneha Kulkarni | sneha.kulkarni@example.com | SUBMITTED |
| 2 | CAMPUSTO-0002 | Anita Deshmukh | anita.deshmukh@example.com | SUBMITTED |
| 3 | CAMPUSTO-0001 | Shreyash Mane | shreyashmanetinu@gmail.com | SUBMITTED |
| 4 | CAMPUSTO-0005 | Vivek Joshi | vivek.joshi@example.com | SUBMITTED |
| 5 | CAMPUSTO-0003 | Rahul Patil | rahul.patil@example.com | SUBMITTED |

---

## Phase 0 — Authentication & Program setup (summary)

* `DRAFT → PUBLISHED → REG_OPEN → REG_CLOSED` advanced via the status API.
* 3 days PATCHed with titles, start/end times, `attendance_enabled`,
  `food_enabled`, `feedback_enabled` and 2 `resource_persons` each.
* Feedback form (`PUT /programs/<id>/forms/feedback/`) returned **201**;
  FeedbackInstance created (`fi_id` above).
* Program detail confirmed: `registration_link_enabled`,
  `feedback_link_enabled`, `public_link_enabled` all `true`.

## Phase 1 — Public registration (summary)

4 registrations created via
`POST /api/v1/public/p/<token>/register/` → **201** each:
`CAMPUSTO-0002` … `CAMPUSTO-0005` (status `SUBMITTED`, each returned an
`attendance_token` and `feedback_token`). A pre-existing `CAMPUSTO-0001`
was added during setup, giving 5 total. Registration numbers start at
`CAMPUSTO-0002` (0001 already existed).

## Phase 2 — Attendance (validated earlier; all 201)

For each of the 3 days: create `AttendanceSession` (**201**) → open it
(**200**) → create a gate (**201**) → mark each of the 5 participants
present via `POST /attendance/program/<p>/day/<d>/mark/` (all **201**;
day 2 had one late, day 3 had a late and an absent).
Roster and per-day stats returned **200**. Result: **15 attendance records**
(5 participants × 3 days).

---

## Phase 3 — Food (3 days)

### Day 1

**1. Create LUNCH service — `POST /food/services/` → 201**
```json
{"program":"7d85c841-…","day":"4516e5ad-…","service_type":"LUNCH",
 "name":"Lunch Day 1","eligibility_rule":{"type":"registration_only"},
 "service_time":"13:00:00"}
```
Response id `08494947-c0e2-4b90-b66b-03a781a5afdc`.

**2. Eligibility — `GET /food/program/<p>/day/<d>/eligibility/` → 200**
(`{day, services:[{food_service, participants:[]}]}`)

**3. Generate QR tokens — `POST /food/program/<p>/day/<d>/generate/` → 200**
```json
{"food_service_id":"08494947-…"}
```
Response:
```json
{"message":"QR generation complete","generated_qrs":5}
```

**4. Send new QRs — `POST /food/program/<p>/day/<d>/send-new/` → 200**
```json
{"newly_sent":5,"failed":0,"already_sent_count":5,"detail":[{"service":"Lunch","newly_sent":5,"failed":0}]}
```

**5. Summary — `GET /food/program/<p>/day/<d>/summary/` → 200**
```json
{"total_registered":5,"eligible":5,"generated":5,"sent":5,"claimed":0,"remaining_to_claim":5,"new_eligible_not_sent":0}
```

**6. Tokens — `GET /food/tokens/?food_service=<id>` → 200**
Returned 5 tokens, each with `email_sent:true`, `email_status:"SENT"` (e.g.
Sneha `9aopwo_1aQtYqvf8Ad3td4heU8Pw185azar3Y7bwocw`, Anita
`asxZCK7pOT-NrW8E4TIdIOuRBN67D6vvCmXFuCxiZBU`, …).

**7. Claim two — `POST /food/program/<p>/day/<d>/claim/` → 200**
```json
{"token":"9aopwo_1aQtYqvf8Ad3td4heU8Pw185azar3Y7bwocw"}
→ {"result":"claimed","message":"Food issued","participant_name":"Sneha Kulkarni"}
{"token":"asxZCK7pOT-NrW8E4TIdIOuRBN67D6vvCmXFuCxiZBU"}
→ {"result":"claimed","message":"Food issued","participant_name":"Anita Deshmukh"}
```

**8. Post-claim summary → 200**: `claimed:2, remaining_to_claim:3`.

### Day 2 & Day 3 (identical flow)

* Service create **201** (ids `039bdeec-…` day 2, `b0c95627-…` day 3).
* generate → **200** `{"generated_qrs":5}` for each.
* send-new → **200** `newly_sent:5` for each.
* summary → **200** `eligible/sent:5` for each.

Food totals: **3 services**, **15 tokens generated & sent**, **2 claimed**.

---

## Phase 4 — Feedback

**1. Activate instance — `POST /feedback/instances/<fi_id>/activate/` → 200**
```json
{"message":"Feedback activated","token":"N_AZt9N474dtDCUx3Z0GCV1HguyXkxKIBfDHBVleJDA"}
```

**2. Registrations lookup — `GET /participants/registrations/?program=<id>` → 200**
(count 5, registration numbers harvested).

**3. Public submissions — `POST /public/p/<token>/feedback/` → 201** (×5)
```json
{"instance_id":"2126958c-…","registration_number":"CAMPUSTO-0004",
 "answers":{"overall_rating":5,"relevance":"Excellent","comments":"Great sessions and well organized. (entry 1)"},
 "is_anonymous":false,"completion_time_seconds":90}
→ {"status":"SUBMITTED","response_id":"ce12f152-…","message":"Feedback submitted successfully"}
```
All 5 registrations (0001..0005) returned **201**.

**4. Analytics — `GET /feedback/program/<p>/analytics/` → 200**
```json
{"total_responses":5,"response_rate":100.0,
 "per_question":{"overall_rating":{"count":5,"sum":23,"values":[5,4,5,4,5]}, …},
 "comments":[{"participant":"Sneha Kulkarni","comment":"…"}, …]}
```

Feedback total: **5 responses / 100% response rate**.

---

## Phase 5 — Certificates

**1. Create template — `POST /certificates/templates/` → 201**
```json
{"name":"Workshop CoE","html_template":"<html><body><h1>Certificate of Participation</h1><p>{{participant_name}}</p><p>{{program_title}}</p></body></html>","page_size":"A4","orientation":"portrait"}
```
Response id `d9fecbb0-41f1-43c9-9da4-6ff723ef881b`.

**2. Configure — `PUT /certificates/program/<p>/config/` → 200**
```json
{"template":"d9fecbb0-…","eligibility_rule":{"type":"registration_only"},
 "certificate_prefix":"CAMPUS","start_number":1}
```
Response: `{"template_name":"Workshop CoE","certificate_prefix":"CAMPUS","current_number":1,"require_manual_approval":true}`.

**3. Eligible — `GET /certificates/program/<p>/eligible/` → 200**
5 participants, all `is_eligible:true`, `basis.rule:"registration_only"`,
`has_certificate:false`.

**4. Generate — `POST /certificates/program/<p>/generate/` → 200**
```json
{"job_id":"e50e5a19-c586-47ee-9dc1-acb100ae53b8","message":"Certificate generation queued"}
```

**5. List — `GET /certificates/?program=<p>` → 200** — 5 certificates
`CAMPUS-000001 … CAMPUS-000005`, status `GENERATED`, each with a
`verification_token`, `verification_url` and generated
`pdf_file` (e.g. `…/media/certificates/pdfs/CAMPUS-000001_8X2OLr2.pdf`).

**6. Public verify — `GET /public/verify/CAMPUS-000001/` → 200**
```json
{"certificate_number":"CAMPUS-000001","status":"GENERATED","valid":true,
 "participant_name":"Sneha Kulkarni","program_title":"Campus to Community",
 "program_date":"2026-09-01 - 2026-09-03","issued_by":"IQAC","issued_date":"2026-08-30"}
```

Certificates total: **5 issued, verifiable**.

---

## Phase 6 — Status lifecycle (all → 200)

| From | To | Response |
|------|----|----------|
| REG_CLOSED | ONGOING | `{"message":"Status changed to ONGOING","status":"ONGOING"}` |
| ONGOING | COMPLETED | `{"message":"Status changed to COMPLETED","status":"COMPLETED"}` |
| COMPLETED | ARCHIVED | `{"message":"Status changed to ARCHIVED","status":"ARCHIVED"}` |

## Final program detail — `GET /programs/<id>/` → 200

`status: "ARCHIVED"`, `registration_schema` 7 fields intact (Full Name,
Email, Contact No., Gender[radio], Date of Birth, Want to Participate[yesno],
Department[select]), `start_date 2026-09-01`, `end_date 2026-09-03`,
`program_type_name "Workshop"`, venue "Dr. A. K. Dorle Auditorium",
coordinator "Nandkishor Karade".

---

## Result summary

| Phase | Calls | Status |
|-------|-------|--------|
| Auth | 1 | 200 |
| Setup + Registration | (validated) | 201 |
| Attendance | (3 days × create/open/gate/mark + roster/stats) | 201/200 |
| Food | 3 services, generate, send, claim(2), summaries | 200/201 |
| Feedback | activate + 5 submissions + analytics | 200/201 |
| Certificates | template, config, eligible, generate, verify | 200/201 |
| Status lifecycle | REG_CLOSED → ONGOING → COMPLETED → ARCHIVED | 200 |

**Verdict: PASS — full 3-day "Campus to Community" workflow runs end-to-end
against the live API, and the public verification endpoint confirms an
issued certificate.**
