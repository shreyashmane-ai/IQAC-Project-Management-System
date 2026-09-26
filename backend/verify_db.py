#!/usr/bin/env python
"""
Verify database connection (MySQL or PostgreSQL)
Run: python verify_db.py
"""
import os
import sys

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Load .env
try:
    from decouple import config
except ImportError:
    print("Install python-decouple: pip install python-decouple")
    sys.exit(1)

DB_ENGINE = config('DB_ENGINE', default='mysql')
DB_HOST = config('DB_HOST', default='localhost')
DB_PORT = config('DB_PORT', default=3306 if DB_ENGINE == 'mysql' else 5432, cast=int)
DB_USER = config('DB_USER', default='iqac_user')
DB_PASSWORD = config('DB_PASSWORD', default='')
DB_NAME = config('DB_NAME', default='iqac_pms')


def test_mysql():
    """Test MySQL connection"""
    try:
        import pymysql
    except ImportError:
        print("✗ mysqlclient not installed: pip install mysqlclient")
        return False

    try:
        conn = pymysql.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            charset='utf8mb4',
            cursorclass=pymysql.cursors.DictCursor
        )
        print(f"✓ Connected to MySQL at {DB_HOST}:{DB_PORT} as {DB_USER}")

        with conn.cursor() as cursor:
            cursor.execute(f"SHOW DATABASES LIKE '{DB_NAME}'")
            result = cursor.fetchone()

            if result:
                print(f"✓ Database '{DB_NAME}' exists")
            else:
                print(f"✗ Database '{DB_NAME}' does not exist")

            cursor.execute("SELECT VERSION()")
            version = cursor.fetchone()['VERSION()']
            print(f"  MySQL Version: {version}")

            cursor.execute("SHOW VARIABLES LIKE 'character_set_server'")
            charset = cursor.fetchone()['Value']
            print(f"  Server charset: {charset}")

            cursor.execute("SHOW VARIABLES LIKE 'collation_server'")
            collation = cursor.fetchone()['Value']
            print(f"  Server collation: {collation}")

            cursor.execute("SELECT @@sql_mode")
            sql_mode = cursor.fetchone()['@@sql_mode']
            print(f"  SQL Mode: {sql_mode}")

            if 'STRICT_TRANS_TABLES' not in sql_mode:
                print("  ⚠ Warning: STRICT_TRANS_TABLES not in sql_mode")

            if 'utf8mb4' not in charset:
                print("  ⚠ Warning: Server charset is not utf8mb4")

        conn.close()
        return True

    except pymysql.err.OperationalError as e:
        print(f"✗ MySQL connection failed: {e}")
        return False
    except Exception as e:
        print(f"✗ Error: {e}")
        return False


def test_postgresql():
    """Test PostgreSQL connection"""
    try:
        import psycopg2
        from psycopg2.extras import RealDictCursor
    except ImportError:
        print("✗ psycopg2 not installed: pip install psycopg2-binary")
        return False

    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database='postgres',  # Connect to default DB first
            cursor_factory=RealDictCursor
        )
        conn.autocommit = True
        print(f"✓ Connected to PostgreSQL at {DB_HOST}:{DB_PORT} as {DB_USER}")

        with conn.cursor() as cursor:
            cursor.execute("SELECT 1 FROM pg_database WHERE datname = %s", (DB_NAME,))
            result = cursor.fetchone()

            if result:
                print(f"✓ Database '{DB_NAME}' exists")
            else:
                print(f"✗ Database '{DB_NAME}' does not exist")

            cursor.execute("SELECT version()")
            version = cursor.fetchone()['version']
            print(f"  PostgreSQL Version: {version.split(',')[0]}")

            cursor.execute("SHOW server_encoding")
            encoding = cursor.fetchone()['server_encoding']
            print(f"  Server encoding: {encoding}")

            cursor.execute("SHOW lc_collate")
            collate = cursor.fetchone()['lc_collate']
            print(f"  Server collation: {collate}")

        conn.close()
        return True

    except psycopg2.OperationalError as e:
        print(f"✗ PostgreSQL connection failed: {e}")
        return False
    except Exception as e:
        print(f"✗ Error: {e}")
        return False


def create_database():
    """Create database if it doesn't exist"""
    if DB_ENGINE == 'mysql':
        return create_mysql_database()
    else:
        return create_postgresql_database()


def create_mysql_database():
    try:
        import pymysql
        conn = pymysql.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            charset='utf8mb4'
        )
        with conn.cursor() as cursor:
            cursor.execute(
                f"CREATE DATABASE IF NOT EXISTS `{DB_NAME}` "
                f"CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
            )
            print(f"✓ Database '{DB_NAME}' created/verified")
        conn.close()
        return True
    except Exception as e:
        print(f"✗ Failed to create MySQL database: {e}")
        return False


def create_postgresql_database():
    try:
        import psycopg2
        conn = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database='postgres'
        )
        conn.autocommit = True
        with conn.cursor() as cursor:
            cursor.execute("SELECT 1 FROM pg_database WHERE datname = %s", (DB_NAME,))
            if not cursor.fetchone():
                cursor.execute(f'CREATE DATABASE "{DB_NAME}" ENCODING "UTF8" LC_COLLATE "en_US.UTF-8" LC_CTYPE "en_US.UTF-8" TEMPLATE template0')
                print(f"✓ Database '{DB_NAME}' created")
            else:
                print(f"✓ Database '{DB_NAME}' already exists")
        conn.close()
        return True
    except Exception as e:
        print(f"✗ Failed to create PostgreSQL database: {e}")
        return False


if __name__ == '__main__':
    print("=" * 50)
    print(f"IQAC PMS - Database Verification ({DB_ENGINE.upper()})")
    print("=" * 50)
    print(f"Host: {DB_HOST}:{DB_PORT}")
    print(f"User: {DB_USER}")
    print(f"Database: {DB_NAME}")
    print("-" * 50)

    if DB_ENGINE == 'mysql':
        success = test_mysql()
    else:
        success = test_postgresql()

    if success:
        print("-" * 50)
        print("✓ Database configuration is correct!")
        print("\nNext steps:")
        print("  1. python manage.py migrate")
        print("  2. python manage.py createsuperuser")
        print("  3. python manage.py runserver")
    else:
        print("-" * 50)
        print("✗ Database configuration needs fixing")
        if DB_ENGINE == 'mysql':
            print("\nFor MySQL:")
            print("  1. Run setup_mysql.sql as root: mysql -u root -p < setup_mysql.sql")
            print("  2. Install driver: pip install mysqlclient")
        else:
            print("\nFor PostgreSQL:")
            print("  1. Create database: createdb -U postgres iqac_pms")
            print("  2. Install driver: pip install psycopg2-binary")
        print("  3. Update .env with correct credentials")
        print("  4. Run this script again")
        sys.exit(1)