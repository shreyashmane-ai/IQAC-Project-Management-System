# IQAC PMS - Backend (Django REST Framework)

> **IQAC PMS** — Internal Quality Assurance Cell · Programme Management System
> Version: **1.0** (Sept 2026) · Running **Django 5.2.6 / DRF 3.17.1 / drf-spectacular 0.30** on **Python 3.13**
> URLs — Admin console: `http://localhost:5173` · API: `http://localhost:8000/api/v1`
> OpenAPI: `http://localhost:8000/api/docs/` (Swagger) / `http://localhost:8000/api/redoc/`
> Admin login: `admin@university.edu` / `Admin@12345`
> Full project reference: `../docs/PROJECT-REFERENCE.md`

A configuration-driven Program Management System for IQAC (Internal Quality Assurance Cell).

## Tech Stack

- **Framework**: Django 5.x + Django REST Framework
- **Database**: MySQL 8.0+ or PostgreSQL 14+ (configurable via `DB_ENGINE`)
- **Cache/Queue**: Redis + Celery
- **Auth**: JWT (SimpleJWT) + RBAC
- **API Docs**: drf-spectacular (OpenAPI 3)
- **File Storage**: S3/MinIO
- **PDF/QR/Excel**: WeasyPrint, qrcode, openpyxl

## Project Structure

```
backend/
├── config/                 # Django project settings
│   ├── settings.py         # Main settings (DB-agnostic)
│   ├── urls.py             # Root URL config
│   ├── celery.py           # Celery config
│   ├── wsgi.py             # WSGI entry
│   └── asgi.py             # ASGI entry
├── core/                   # Core functionality
│   ├── models.py           # Base models (TimeStamped, UUID, SoftDelete, Audit)
│   ├── models_user.py      # User, Roles, ProgramAssignment, AuditLog
│   ├── permissions.py      # Custom RBAC permissions
│   ├── exceptions.py       # Standardized error handling
│   └── urls_*.py           # URL configs
├── programs/               # Programs, Sessions, Master Data
├── participants/           # Participants, Registrations, Waitlist
├── attendance/             # Attendance Records, Sessions, Gates
├── food/                   # Food Services, Eligibility, Tokens, Claims
├── feedback/               # Feedback Instances, Responses, Analytics
├── certificates/           # Templates, Configs, Certificates, Batch Jobs
├── reports/                # Report Columns, Presets, Exports
├── documents/              # Documents, Generated Artifacts
├── notifications/          # Templates, Messages, Batches
└── manage.py               # Django management script
```

## Key Features

### Configuration-Driven
- Dynamic forms (registration/feedback) via JSON schemas
- Per-day service toggles (attendance, food, feedback)
- Configurable certificate eligibility rules
- Column-selectable reports

### Concurrency-Safe Design
- **Registration**: DB unique constraint on (program, identity_key)
- **Attendance**: Unique constraint on (participant, day) - idempotent scans
- **Food Claims**: Atomic compare-and-set for single-use tokens
- **Bulk Operations**: Redis locks for "send to newly eligible"

### Role-Based Access Control
| Role | Scope |
|------|-------|
| SA (System Admin) | All programs, users, master data |
| PA (Program Admin) | All programs, session-level |
| PC (Program Coordinator) | Assigned programs only |
| AO (Attendance Operator) | Attendance scanning for assigned programs |
| FO (Food Operator) | Food QR generation/claim for assigned programs |
| V (Viewer) | Read-only dashboards/reports |

## Quick Start

### Prerequisites
- Python 3.11+
- **MySQL 8.0+** (recommended)
- Redis 7+

### Installation

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt

# For MySQL (development)
pip install mysqlclient

# For PostgreSQL (production alternative)
# pip install psycopg2-binary

cp .env.example .env
# Edit .env with your database configuration.
# SECRET_KEY is REQUIRED — the server refuses to start without it.

# Verify database connection
python verify_db.py

# Run migrations
python manage.py migrate

# Create an admin account (or use the seeded admin@university.edu / Admin@12345)
python manage.py createsuperuser

# Run the dev server (http://localhost:8000)
python manage.py runserver
```

### Development Commands

```bash
# Run migrations
python manage.py makemigrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Collect static files
python manage.py collectstatic

# Run tests
pytest

# Generate OpenAPI schema
python manage.py spectacular --file schema.yml

# Start Celery worker
celery -A config worker -l INFO -Q default,emails,reports,certificates,food,documents

# Start Celery Beat (scheduler)
celery -A config beat -l INFO --scheduler django_celery_beat.schedulers:DatabaseScheduler
```

## Environment Variables

See `.env.example` for all options. Key variables:

| Variable | Description |
|----------|-------------|
| `DB_ENGINE` | `mysql` or `postgresql` |
| `DB_NAME` | Database name |
| `DB_USER` | Database user |
| `DB_PASSWORD` | Database password |
| `DB_HOST` | Database host |
| `DB_PORT` | Database port |
| `SECRET_KEY` | Django secret key — **required, no default** (server won't start without it) |
| `DEBUG` | `True`/`False` — **defaults to False** |
| `ALLOWED_HOSTS` | Comma-separated hosts (localhost assumed only while DEBUG) |
| `PUBLIC_SITE_URL` | Public site origin used in links/QRs (e.g. `http://localhost:5173`) |
| `FRONTEND_URL` | Frontend console origin for verification URLs |
| `CORS_ALLOWED_ORIGINS` | Comma-separated origins (default `http://localhost:5173`) |
| `SECURE_SSL_REDIRECT` | `True` behind TLS (enables HTTPS redirect) |
| `SECURE_HSTS_SECONDS` | HSTS max-age in seconds (e.g. `31536000`) |
| `SESSION_COOKIE_SECURE` / `CSRF_COOKIE_SECURE` | `True` in production |
| `CELERY_BROKER_URL` | Redis URL (db 0) — Celery broker |
| `CELERY_RESULT_BACKEND` | Redis URL (db 1) — Celery results |
| `REDIS_URL` | Redis URL (db 2) — Django cache + DRF rate throttling |
| `AWS_S3_ENDPOINT_URL` | MinIO endpoint (optional) |

## API Documentation

- **Health**: `http://localhost:8000/api/v1/health/` (DB + Redis cache + Celery broker)
- **Swagger UI**: `http://localhost:8000/api/docs/`
- **ReDoc**: `http://localhost:8000/api/redoc/`
- **OpenAPI Schema**: `http://localhost:8000/api/schema/`

## Database Migration

See [DATABASE_MIGRATION.md](DATABASE_MIGRATION.md) for migrating between MySQL and PostgreSQL.

## Production Deployment

### Systemd Services

```bash
# Web (Gunicorn)
sudo cp deploy/iqac-pms-web.service /etc/systemd/system/
sudo systemctl enable --now iqac-pms-web

# Celery Worker
sudo cp deploy/iqac-pms-celery.service /etc/systemd/system/
sudo systemctl enable --now iqac-pms-celery

# Celery Beat
sudo cp deploy/iqac-pms-beat.service /etc/systemd/system/
sudo systemctl enable --now iqac-pms-beat
```

### Nginx Configuration

```nginx
server {
    listen 80;
    server_name iqac.university.edu;

    location /static/ { alias /opt/iqac-pms/staticfiles/; }
    location /media/  { alias /opt/iqac-pms/media/; }

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Core Workflows

### 1. Program Creation
```
Academic Session → Program → Days → Services → Forms → Review → Publish
```

### 2. Registration
```
Public Link → Dynamic Form → Validation → Duplicate Check → Capacity Check → Confirmation
```

### 3. Attendance
```
Day Active → Scan Token → Validate → Idempotent Mark → Update Matrix
```

### 4. Food Distribution
```
Attendance → Eligibility Compute → Generate QR → Send to New Only → Claim (Atomic)
```

### 5. Feedback
```
Configure Instance → Activate Link → Collect Responses → Auto Analytics
```

### 6. Certificates
```
Config Eligibility → Compute Eligible → Generate PDFs → Send → Verify
```

## Testing

`pytest` / `pytest-django` are declared in `requirements.txt`, but **no test files
exist yet** (`attendance/tests/test_concurrency.py` referenced below is planned, not
present). When tests are added:

```bash
# Unit tests
pytest core/ programs/ participants/ attendance/ food/ feedback/ certificates/ reports/ documents/ notifications/

# Coverage
pytest --cov=core --cov=programs --cov=participants ...

# Specific module
pytest attendance/tests/test_concurrency.py -v
```

## License

Internal use - University IQAC