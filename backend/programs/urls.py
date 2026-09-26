from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views


router = DefaultRouter()
# NOTE: the root '' viewset is registered LAST so its catch-all detail route
# (^(?P<pk>[^/.]+)/$) does not shadow the named single-segment prefixes above.
router.register(r'sessions', views.AcademicSessionViewSet, basename='session')
router.register(r'masters/academic-departments', views.AcademicDepartmentViewSet, basename='academic-department')
router.register(r'masters/admin-departments', views.AdministrativeDepartmentViewSet, basename='admin-department')
router.register(r'masters/designations', views.DesignationViewSet, basename='designation')
router.register(r'masters/program-types', views.ProgramTypeViewSet, basename='program-type')
router.register(r'masters/venues', views.VenueViewSet, basename='venue')
router.register(r'masters/question-types', views.QuestionTypeViewSet, basename='question-type')
router.register(r'masters/food-types', views.FoodTypeViewSet, basename='food-type')
router.register(r'days', views.ProgramDayViewSet, basename='program-day')
router.register(r'services', views.ProgramServiceConfigViewSet, basename='service-config')
router.register(r'', views.ProgramViewSet, basename='program')

urlpatterns = [
    path('', include(router.urls)),
    
    # Program-specific nested routes
    path('<uuid:program_id>/forms/registration/', views.RegistrationFormView.as_view(), name='registration-form'),
    path('<uuid:program_id>/forms/feedback/', views.FeedbackFormView.as_view(), name='feedback-form'),
    path('<uuid:program_id>/link/', views.ProgramLinkView.as_view(), name='program-link'),
    path('<uuid:program_id>/link/regenerate/', views.ProgramLinkRegenerateView.as_view(), name='program-link-regenerate'),
    path('<uuid:program_id>/link/state/', views.ProgramLinkStateView.as_view(), name='program-link-state'),
    path('<uuid:program_id>/status/', views.ProgramStatusView.as_view(), name='program-status'),
    path('<uuid:program_id>/dashboard/', views.ProgramDashboardView.as_view(), name='program-dashboard'),
    path('<uuid:program_id>/closure/readiness/', views.ProgramClosureReadinessView.as_view(), name='closure-readiness'),
    path('<uuid:program_id>/closure/close/', views.ProgramClosureView.as_view(), name='closure-close'),
]