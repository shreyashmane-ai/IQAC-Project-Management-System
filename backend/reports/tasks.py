"""
Reports app Celery tasks
"""
import io
from celery import shared_task
from django.utils import timezone
from django.conf import settings


@shared_task
def generate_export(*args):
    """
    Generate a report export file (async).
    Supports either an export record id OR legacy (program_id, report_type,
    columns, filters, format) positional args.
    """
    from .models import ReportExport

    if len(args) == 1 and isinstance(args[0], str):
        export_id = args[0]
        try:
            export = ReportExport.objects.get(id=export_id)
        except ReportExport.DoesNotExist:
            return {'status': 'NOT_FOUND'}
        program_id = export.program_id
        report_type = export.report_type
        columns = export.selected_columns
        filters = export.filters
        fmt = export.format
    elif len(args) >= 5:
        # Legacy call signature
        export_id = None
        export = None
        program_id = args[0]
        report_type = args[1]
        columns = args[2]
        filters = args[3]
        fmt = args[4]
    else:
        return {'status': 'INVALID_ARGS'}

    try:
        export.status = 'PROCESSING'
        if export:
            export.started_at = timezone.now()
            export.save(update_fields=['status', 'started_at'])

        rows = _fetch_rows(program_id, report_type, filters, columns)
        file_data = _render_file(rows, columns, fmt)

        row_count = len(rows)
        if export:
            export.status = 'COMPLETED'
            export.row_count = row_count
            export.completed_at = timezone.now()
            export.save(
                update_fields=['status', 'row_count', 'completed_at'],
            )
            export.file.save(
                f"{export.report_type}-{export.id}.{fmt.lower()}", file_data, save=True
            )

        return {
            'status': 'COMPLETED',
            'row_count': row_count,
            'export_id': str(export.id) if export else '',
        }
    except Exception as exc:
        if export:
            export.status = 'FAILED'
            export.error_message = str(exc)[:1000]
            export.completed_at = timezone.now()
            export.save(update_fields=['status', 'error_message', 'completed_at'])
        return {'status': 'FAILED', 'error': str(exc)}


def _fetch_rows(program_id, report_type, filters, selected_columns):
    """Fetch rows for report. Simplified implementations per report type."""
    from participants.models import Registration

    qs = Registration.objects.filter(program_id=program_id).select_related('participant', 'participant__department')
    if filters.get('status'):
        qs = qs.filter(status=filters['status'])

    if report_type == 'PARTICIPANT_STATUS':
        rows = []
        for reg in qs:
            rows.append({
                'registration_number': reg.registration_number,
                'participant_name': reg.participant.full_name,
                'email': reg.participant.email,
                'department': reg.participant.department.name if reg.participant.department else '',
                'status': reg.status,
            })
        return rows

    # Generic fallback
    return [
        {
            'registration_number': r.registration_number,
            'participant_name': r.participant.full_name,
            'email': r.participant.email,
            'status': r.status,
        }
        for r in qs
    ]


def _render_file(rows, selected_columns, fmt):
    """Render rows to XLSX/CSV/PDF bytes."""
    columns = selected_columns or (list(rows[0].keys()) if rows else [])
    fmt = (fmt or 'XLSX').upper()

    if fmt == 'CSV':
        import csv
        buffer = io.StringIO()
        writer = csv.DictWriter(buffer, fieldnames=columns, extrasaction='ignore')
        writer.writeheader()
        for row in rows:
            writer.writerow(row)
        return io.BytesIO(buffer.getvalue().encode('utf-8-sig'))

    if fmt == 'PDF':
        text = '\n'.join(['\t'.join(str(row.get(c, '')) for c in columns) for row in rows])
        return io.BytesIO(text.encode('utf-8'))

    # XLSX default
    try:
        from openpyxl import Workbook
        wb = Workbook()
        ws = wb.active
        ws.append(columns)
        for row in rows:
            ws.append([row.get(c, '') for c in columns])
        buffer = io.BytesIO()
        wb.save(buffer)
        buffer.seek(0)
        return buffer
    except ImportError:
        text = '\n'.join(
            ['\t'.join(str(row.get(c, '')) for c in columns) for row in rows]
        )
        return io.BytesIO(('Title\t' + '\t'.join(columns) + '\n' + text).encode('utf-8'))