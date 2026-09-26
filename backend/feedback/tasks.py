"""
Feedback app Celery tasks
"""
from celery import shared_task
from django.db.models import Avg


@shared_task
def recompute_feedback_analytics(instance_id):
    """Recompute and cache analytics for a feedback instance."""
    from .models import FeedbackInstance, FeedbackResponse, FeedbackAnalytics

    try:
        instance = FeedbackInstance.objects.get(id=instance_id)
    except FeedbackInstance.DoesNotExist:
        return {'status': 'NOT_FOUND'}

    responses = FeedbackResponse.objects.filter(feedback_instance=instance)
    total = responses.count()

    # Registered participants for completion rate
    registered = instance.program.registrations.filter(
        status__in=['APPROVED', 'SUBMITTED']
    ).count()
    completion_rate = (total / registered * 100) if registered else 0

    # Average rating
    ratings = [r.answers.get('rating') for r in responses if isinstance(r.answers.get('rating'), (int, float))]
    avg_rating = sum(ratings) / len(ratings) if ratings else None

    # Per-question analytics
    question_analytics, rating_distribution, comments = _compute_details(responses)

    analytics, _ = FeedbackAnalytics.objects.update_or_create(
        feedback_instance=instance,
        defaults={
            'total_responses': total,
            'completion_rate': round(completion_rate, 2),
            'average_rating': round(avg_rating, 2) if avg_rating else None,
            'question_analytics': question_analytics,
            'rating_distribution': rating_distribution,
            'comments': comments,
        },
    )
    return {
        'instance': str(instance_id),
        'total_responses': total,
        'completion_rate': round(completion_rate, 2),
    }


@shared_task
def update_all_analytics():
    """Recompute analytics for all active/closed feedback instances."""
    from .models import FeedbackInstance

    count = 0
    for instance in FeedbackInstance.objects.filter(status__in=['ACTIVE', 'CLOSED']):
        recompute_feedback_analytics(str(instance.id))
        count += 1
    return {'updated_instances': count}


def _compute_details(responses):
    question_analytics = {}
    rating_distribution = {}
    comments = []

    for r in responses:
        answers = r.answers or {}
        for q_name, value in answers.items():
            if q_name == 'rating':
                rating_distribution[str(value)] = rating_distribution.get(str(value), 0) + 1
                continue
            if q_name == 'comments':
                if value:
                    comments.append({'participant': r.participant.full_name, 'text': value})
                continue
            if q_name not in question_analytics:
                question_analytics[q_name] = {'count': 0}
            question_analytics[q_name]['count'] += 1

    return question_analytics, rating_distribution, comments