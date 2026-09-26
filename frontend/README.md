# IQAC PMS — Frontend (React + TypeScript + Vite)

> **IQAC PMS** — Internal Quality Assurance Cell · Programme Management System
> Version: **1.0** (Sept 2026) · **Vite ^8.2** · **React ^19.2** · **TypeScript ~6.0**
> URLs — Admin console: `http://localhost:5173` · API: `http://localhost:8000/api/v1`
> OpenAPI: `http://localhost:8000/api/docs/` (Swagger) / `http://localhost:8000/api/redoc/`
> Admin login: `admin@university.edu` / `Admin@12345`
> Full project reference: `../docs/PROJECT-REFERENCE.md`

Admin console for IQAC PMS: programs (wizard), participant management, attendance,
food QRs, feedback, certificates, documents, notifications, reports and audit log,
plus the token-scoped public pages (register / My QRs / feedback).

## Stack

- **Vite** (dev server + build), **React 19**, **TypeScript ~6.0** (strict)
- **react-router-dom 7** (admin console + public plane routes)
- **axios** (`api/client.ts`, `baseURL: '/api/v1'`) with JWT refresh, a cancellable
  request helper, and a global `iqac:unauthorized` event
- **@tiptap** rich-text editor, **prosemirror** bundle
- Lint: **oxlint** (`npm run lint`) · type-check/build: `tsc -b && vite build`

## Commands

```powershell
# dev server -> http://localhost:5173
npm.cmd run dev

# type-check + production build (dist/)
npm.cmd run build

# lint
npm.cmd run lint
```

## Structure

```
frontend/src/
├── api/            # axios modules + typed clients (auth, programs, participants, …)
├── auth/           # AuthProvider / AuthContext
├── components/     # shared UI (Btn, TextInput, TSelect, Stat, DataTable, Toasts, …)
├── hooks/          # useAuth (+ any shared hooks)
├── layouts/        # admin layout (collapsible sidebar, topbar)
├── pages/          # route pages (admin + public/)
├── types/          # shared TS types, MASTERS definitions
└── utils/          # non-component helpers (date, html, overlay, dynamicForm, …)
```

**Convention:** component files (`components/`, `pages/`, `layouts/`) export
components only; pure helpers/types live in `utils/` and `hooks/` so modules stay
Fast-Refresh friendly (enforced by oxlint `only-export-components`).