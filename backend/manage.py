# IQAC PMS - Manage script
import os
import sys


def _ensure_db_driver():
    """Use pymysql as the MySQLdb driver for django.db.backends.mysql."""
    try:
        import MySQLdb  # noqa: F401  (native mysqlclient already available)
    except ImportError:
        try:
            import pymysql
            pymysql.install_as_MySQLdb()
        except ImportError:
            pass


def main():
    """Run administrative tasks."""
    _ensure_db_driver()
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == '__main__':
    main()