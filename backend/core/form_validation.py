"""
Shared server-side validation of dynamic form submissions (BE-FORM-03).

Both registration and feedback submissions are validated against the
program/instance form schema before acceptance. Client-side validation is
convenience only; this module is the authoritative check.

Schema format (documented in ProgramFormSerializer):

    schema = {
        "fields": [
            {
                "name": "field_name",
                "type": "text|longtext|email|phone|number|decimal|select|radio|
                         checkbox|yesno|rating|scale|date|file|section",
                "label": "Field Label",
                "required": true,
                "options": ["a", "b"],       # for select/radio/checkbox
                "validation": {
                    "min_length": 1, "max_length": 200,   # text/longtext
                    "min": 0, "max": 100, "decimal_places": 2,  # number/decimal
                    "min_select": 1, "max_select": 3,     # checkbox
                },
            },
        ]
    }
"""

from rest_framework import serializers

# Field types that accept a closed set of options
OPTION_TYPES = {'select', 'radio', 'checkbox'}

# Field types that carry numeric semantics
NUMERIC_TYPES = {'number', 'decimal'}


def validate_form_submission(schema, answers, *, reject_unknown=True):
    """
    Validate a dict of answers against a form schema.

    Returns a list of (field, message) tuples. An empty list means valid.
    - Validates required/type/range/options/length per field config.
    - If reject_unknown is True, unknown/extra top-level keys fail validation.
    """
    errors = []

    if not isinstance(schema, dict):
        return [('__schema__', 'Invalid form schema')]

    fields = schema.get('fields', [])
    if not isinstance(fields, list):
        return [('__schema__', 'Invalid form schema fields')]

    if not isinstance(answers, dict):
        return [('__answers__', 'Answers must be an object')]

    known = set()

    for field in fields:
        if not isinstance(field, dict):
            continue
        name = field.get('name')
        if not name:
            continue
        known.add(name)

        ftype = field.get('type', 'text')
        label = field.get('label') or name
        required = bool(field.get('required', False))
        validation = field.get('validation') or {}
        options = field.get('options') or []

        present = name in answers and answers[name] is not None and answers[name] != ''
        if not present:
            if required:
                errors.append((name, f'{label} is required.'))
            continue

        value = answers[name]

        # Expected types
        if ftype in {'checkbox'} and isinstance(value, str):
            value = value.split(',') if value else []
        if ftype in {'checkbox'} and not isinstance(value, list):
            errors.append((name, f'{label} must be a list.'))
            continue

        if isinstance(value, list):
            # MSQ / checkbox selection validation
            if ftype in {'checkbox'} and options:
                invalid = [v for v in value if v not in options]
                if invalid:
                    errors.append((name, f'{label} contains an invalid option.'))
            mn = validation.get('min_select')
            mx = validation.get('max_select')
            if mn is not None and len(value) < mn:
                errors.append((name, f'Select at least {mn} option(s) for {label}.'))
            if mx is not None and len(value) > mx:
                errors.append((name, f'Select at most {mx} option(s) for {label}.'))
            continue

        # Scalars from here
        if ftype in OPTION_TYPES and options:
            if value not in options:
                errors.append((name, f'{label} must be one of the provided options.'))
            continue

        if ftype in NUMERIC_TYPES or ftype == 'rating':
            try:
                num = float(value)
            except (TypeError, ValueError):
                errors.append((name, f'{label} must be a number.'))
                continue
            mn = validation.get('min')
            mx = validation.get('max')
            if mn is not None and num < mn:
                errors.append((name, f'{label} must be at least {mn}.'))
            if mx is not None and num > mx:
                errors.append((name, f'{label} must be at most {mx}.'))
            if ftype == 'decimal' and validation.get('decimal_places') is not None:
                dp = validation['decimal_places']
                if num != round(num, dp):
                    errors.append((name, f'{label} allows at most {dp} decimal places.'))
            continue

        if ftype == 'email':
            if '@' not in str(value) or '.' not in str(value).split('@')[-1]:
                errors.append((name, f'{label} must be a valid email address.'))
            continue

        if ftype == 'phone':
            cleaned = ''.join(ch for ch in str(value) if ch.isdigit())
            if not (7 <= len(cleaned) <= 15):
                errors.append((name, f'{label} must be a valid mobile number.'))
            continue

        if ftype == 'yesno':
            if value not in (True, False, 'yes', 'no', 'Yes', 'No'):
                errors.append((name, f'{label} must be Yes or No.'))
            continue

        if ftype == 'date':
            # accept ISO date string
            from datetime import date
            if isinstance(value, str):
                try:
                    date.fromisoformat(value)
                except ValueError:
                    errors.append((name, f'{label} must be a valid date.'))
            continue

        if ftype in {'text', 'longtext'}:
            sval = str(value)
            minlen = validation.get('min_length')
            maxlen = validation.get('max_length')
            if minlen is not None and len(sval) < minlen:
                errors.append((name, f'{label} must be at least {minlen} character(s).'))
            if maxlen is not None and len(sval) > maxlen:
                errors.append((name, f'{label} must be at most {maxlen} character(s).'))
            continue

    if reject_unknown and known:
        for key in answers:
            if key not in known:
                errors.append((key, 'Unknown field.'))

    return errors


def raise_validation_error(errors):
    """
    Convert `errors` (list of (field, message)) into a DRF ValidationError in
    the field-errors envelope the frontend renders inline.
    """
    if errors:
        field_map = {}
        for field, message in errors:
            field_map.setdefault(field, message)
        raise serializers.ValidationError(field_map)
