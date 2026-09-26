# IQAC PMS — Compliance & Accessibility Report

Scope: frontend (`frontend/`) and Django backend (`backend/`). Written 26 Sep 2026.

## 1. India DPDP Act, 2023 — status

### Addressed in this release

| Item | Where | Status |
| --- | --- | --- |
| Explicit consent at registration | `frontend/src/pages/public/PublicRegisterPage.tsx` (required checkbox + link to Privacy Policy), payload now sends `consent: true` | Done |
| Server-side consent enforcement (no silent default) | `backend/participants/views_public.py` → `CONSENT_REQUIRED` 422 unless `consent` truthy; `consent_given=True` + `consent_date` recorded | Done |
| Privacy, Terms, Cookie (local-storage) and Refund policies | `frontend/src/pages/public/LegalPages.tsx`, routed at `/privacy`, `/terms`, `/cookies`, `/refunds`, linked from footer | Done |
| Consent record + only-necessary storage | `frontend/src/components/CookieConsent.tsx` — banner, stores `iqac-consent`; Google Fonts CDN gated behind consent (links removed from `index.html`) | Done |
| No analytics / third-party trackers | audited — none present (no GA/gtag/Pixel/Sentry). Sole external request is the optional Google Fonts CDN | Verified |
| Data minimisation statement | Only identity fields the participant submits + attendance/food/certificate activity is stored | Documented in policies |

### Personal data stored (by module)

- `core User` (staff / admins): name, email, password hash, role, scopes, 2FA secret (encrypted), auth activity, refresh-token records.
- `participants Participant`: `full_name`, `email`, `mobile`, `institution`, department, designation, `city/state/country`, `extra_data`, `consent_given`, `consent_date`; `Registration`: `form_data` (free-form JSON), `identity_key_values`.
- `attendance AttendanceRecord`: participant, day, gate name, timestamp.
- `food FoodClaim`: `device_info` (browser/platform string submitted with claim), claimed time. `FoodToken` per service/day.
- `certificates`: certificate data + verification activity implied by logs.
- `audit AuditLog`: every admin mutation with actor + `after` JSON; IP addresses are captured.
- `notifications`: sent messages per program/organiser.

### Risks flagged — NOT yet addressed (roadmap)

1. **No retention / erasure flows.** `Participant`/`Registration` deletes cascade widely (food tokens, attendance, certs, feedback, AuditLog). A right-to-erasure request cannot currently be honoured cleanly by an admin UI. Recommend: soft-delete + purge job + per-participant erasure ticket.
2. **Fail-open `HasProgramScope`.** `backend/core/permissions.py:39-41` and `:58-59` return `True` when there is no program id / no program relation, and `:44-45`/`:62-63` return `True` when a coordinator has a `None` scope list. This trusts object-level checks that may not run. Recommend: fail closed, keep explicit allow-list for views with no program context.
3. **`.env` secrets.** Real secrets (incl. Gmail app password) live in `backend/.env`; `DEBUG=True`. Rotate credentials; keep `.env` out of version control; set `DEBUG=False` behind HTTPS.
4. **HTTPS hardening not enforced in app.** `SECURE_SSL_REDIRECT`/HSTS/cookie-secure depend on deployment proxy. JWT tokens live in `localStorage` (`iqac_access`, `iqac_refresh`) → XSS would expose them; mitigations: no third-party scripts (verified), CSP/reporting recommended.
5. **Password-reset is a stub** (`auth` public flow sends OTP?). Confirm OTP-in-email path and expire codes.
6. **`/admin/` and documented default credentials** — rotate the seeded admin password and disable the documented `admin@university.edu / Admin@12345`.
7. **`/verify` certificate page releases public info (participant name, program, dates)** — intentional (anti-fraud) but confirm this matches organiser policy.
8. **Food `device_info`** stores browser/platform detail — not essential for the feature; recommend dropping the field at claim time or pseudo-anonymising.
9. Email delivery sends participant emails (and IP) to the configured SMTP provider (Gmail). Disclosed in Privacy Policy.

## 2. Cookies / local storage

Stored keys: `iqac_access`, `iqac_refresh` (JWT — strictly necessary), `iqac-dt-density` (preference), `iqac-consent` (consent record — preference). No `document.cookie` usage. Google Fonts is the only network dependency, now loaded only after consent.

## 3. Third-party embeds

One: Google Fonts CDN (Fira Sans / Fira Code), consent-gated. No iframes, no beacons, no analytics. Deleted an unused social-icon sprite (`frontend/public/icons.svg`) — it embedded Bluesky/Discord/GitHub marks that were not used.

## 4. Accessibility (WCAG 2.1 AA) — changes made

- **Contrast:** `--muted2` `#94a3b8 → #6b7280` (≈4.8:1); new `--border-strong #8396ab` (≈3:1) applied to all interactive input borders (fields, `.dt-search`, modal inputs, page-size select); `.icon-btn` bubble/notification dot darkened; red/rose, amber and green-status text darkened to AA (`#be123c`, `#92400e`, `--success-d #15803d`); `.btn.danger`, `.modal-mark.danger`, toasts, ON/OFF states, scanner result and "Late" stat updated; sort idle icon, `.loading`, `.page-fallback`, empty-state text bumped.
- **Labels:** `TextInput` gained `label`/`id`/`ariaLabel`; `DynamicForm` now emits real `label htmlFor`, `aria-required`, `aria-invalid`, `aria-describedby`; public forms (register, feedback, attendance, my-QRs, verify certificate) now have visible associated labels and submit via real `<form onSubmit>` → Enter-submits work.
- **ARIA:** mode toggle `aria-pressed`; toolbar buttons `aria-pressed`; MultiSelect is a `combobox`/`listbox` with `aria-expanded`, `aria-selected`, Escape-to-close + focus restore; ON/OFF link toggles `aria-pressed`; every decorative SVG in `src` now carries `aria-hidden="true"` (22/22 verified).
- **Invalid HTML fixed:** removed nested `<a><button>` in PublicProgramPage, PublicRegisterPage, PublicFeedbackPage, PublicAttendancePage, ProgramDetailPage, ProgramWizardPage (replaced with styled `<Link className="btn">`).
- **Missing styles fixed:** `.inp`/`.lbl` (used by attendance page) and `.successbox` were undefined; added to `index.css`.
- **Images:** all `<img>` already carry `alt`; favicon is self-hosted; no stock imagery → no image-licensing exposure.

### Remaining / optional
- Keyboard-roving on the MultiSelect open list (arrow navigation) — options are still focusable/toggleable via checkbox; full combobox arrow-nav is a follow-up.
- Full native `aria-live` announcements on async load/error regions — partial (Err boxes have text) but not wired as polite regions.

## 5. Compliance of claims / reviews
No testimonials, fake reviews or unsupported marketing claims exist in the codebase or UI (audited). The only brand mention on the public shell is "IQAC PMS"; the deleted `icons.svg` was the only third-party trademark asset and was not displayed.

## 6. Business details
Public footer now states the operator ("IQAC PMS — Internal Quality Assurance Cell Program Management System", self-hosted) with contact email `shreyashmane.ai@gmail.com` (matches backend `DEFAULT_FROM_EMAIL`), plus policy links and "Cookie Preferences" control.

## 7. How to re-run verification
- Frontend: `npm.cmd run lint` (oxlint) and `npm.cmd run build` (tsc -b + vite).
- Backend: `python manage.py check` (run in `backend/`).
- Manual: register a program → public register requires consent; toggle a link ON in Links & QR; confirm banner appears on a fresh browser, "Only required" never fetches `fonts.googleapis.com`.