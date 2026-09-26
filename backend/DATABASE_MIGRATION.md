# IQAC PMS - Database Migration Strategy

## Overview

This document describes how to migrate between MySQL and PostgreSQL without data loss.

## Database-Agnostic Design

All models use Django's built-in field types that work identically on both databases:

| Django Field | MySQL | PostgreSQL |
|-------------|-------|------------|
| `UUIDField` | `CHAR(32)` | `UUID` |
| `JSONField` | `JSON` | `JSONB` |
| `DateTimeField` | `DATETIME(6)` | `TIMESTAMP WITH TIME ZONE` |
| `GenericIPAddressField` | `VARCHAR(39)` | `INET` |
| `AutoField/BigAutoField` | `BIGINT AUTO_INCREMENT` | `BIGSERIAL` |

## Migration Process

### MySQL → PostgreSQL

```bash
# 1. Dump MySQL data (structure + data)
mysqldump -u iqac_user -p --single-transaction --routines --triggers \
  --no-create-info --complete-insert --extended-insert=FALSE \
  iqac_pms > mysql_data.sql

# 2. Create PostgreSQL schema using Django migrations
DB_ENGINE=postgresql python manage.py migrate

# 3. Load data (may need manual cleanup for JSON/UUID differences)
# Use Django's loaddata or custom script for complex migrations
```

### PostgreSQL → MySQL

```bash
# 1. Dump PostgreSQL data
pg_dump -U iqac_user --data-only --column-inserts iqac_pms > pg_data.sql

# 2. Create MySQL schema using Django migrations
DB_ENGINE=mysql python manage.py migrate

# 3. Load data
```

## Key Considerations

### 1. JSONField Differences
- **MySQL**: `JSON` type (text-based, functional indexes)
- **PostgreSQL**: `JSONB` (binary, GIN indexes, faster queries)

**Queries that work on both:**
```python
# Exact match
MyModel.objects.filter(data__key='value')

# Contains
MyModel.objects.filter(data__contains={'key': 'value'})

# Key exists
MyModel.objects.filter(data__has_key='key')
```

**PostgreSQL-specific (avoid for portability):**
```python
# These may not work on MySQL
MyModel.objects.filter(data__key__gt=10)
MyModel.objects.filter(data__keys__contains=['a', 'b'])
```

### 2. UUID Primary Keys
- Both support UUID PKs
- Use `uuid.uuid4()` for generation (not database-generated)

### 3. Case Sensitivity
- **MySQL**: Case-insensitive by default (depends on collation)
- **PostgreSQL**: Case-sensitive

**Always use explicit case handling:**
```python
# Use __iexact for case-insensitive
User.objects.filter(email__iexact='user@example.com')

# Or normalize on save
def save(self, *args, **kwargs):
    self.email = self.email.lower()
    super().save(*args, **kwargs)
```

### 4. Indexes
```python
# Use Django's Index classes (portable)
class Meta:
    indexes = [
        models.Index(fields=['field1', 'field2']),
        models.Index(fields=['field1'], condition=models.Q(field2='value')),
    ]
```

### 5. Constraints
```python
# Use Django's constraints (portable)
class Meta:
    constraints = [
        models.UniqueConstraint(
            fields=['field1', 'field2'],
            condition=models.Q(is_active=True),
            name='unique_active_field1_field2'
        ),
    ]
```

## Testing Migration

1. **Development**: Run tests on both databases in CI
2. **Staging**: Full data migration test before production
3. **Rollback Plan**: Keep both database configs ready

## Recommended Settings

### MySQL (my.cnf)
```ini
[mysqld]
default_authentication_plugin=mysql_native_password
innodb_strict_mode=ON
sql_mode=STRICT_TRANS_TABLES,NO_ZERO_DATE,NO_ZERO_IN_DATE,ERROR_FOR_DIVISION_BY_ZERO
character_set_server=utf8mb4
collation_server=utf8mb4_unicode_ci
max_allowed_packet=64M
```

### PostgreSQL (postgresql.conf)
```ini
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 16MB
maintenance_work_mem = 64MB
random_page_cost = 1.1  # For SSD
```

## Django Settings for Both

```python
# settings.py - Database config
DB_ENGINE = config('DB_ENGINE', default='mysql')

if DB_ENGINE == 'postgresql':
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            # ... postgresql config
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.mysql',
            'OPTIONS': {
                'init_command': "SET sql_mode='STRICT_TRANS_TABLES', innodb_strict_mode=ON",
                'charset': 'utf8mb4',
            },
            # ... mysql config
        }
    }
```