from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views


router = DefaultRouter()
router.register(r'services', views.FoodServiceViewSet, basename='food-service')
router.register(r'eligibility', views.FoodEligibilityViewSet, basename='food-eligibility')
router.register(r'tokens', views.FoodTokenViewSet, basename='food-token')
router.register(r'claims', views.FoodClaimViewSet, basename='food-claim')
router.register(r'summary', views.FoodSummaryViewSet, basename='food-summary')

urlpatterns = [
    path('', include(router.urls)),
    
    # Program/day scoped - the core food workflow
    path('program/<uuid:program_id>/day/<uuid:day_id>/eligibility/', views.DayFoodEligibilityView.as_view(), name='day-food-eligibility'),
    path('program/<uuid:program_id>/day/<uuid:day_id>/generate/', views.GenerateFoodQRView.as_view(), name='generate-food-qr'),
    path('program/<uuid:program_id>/day/<uuid:day_id>/send-new/', views.SendNewEligibleView.as_view(), name='send-new-eligible'),
    path('program/<uuid:program_id>/day/<uuid:day_id>/summary/', views.DayFoodSummaryView.as_view(), name='day-food-summary'),
    path('program/<uuid:program_id>/day/<uuid:day_id>/pre-send/', views.PreSendSummaryView.as_view(), name='pre-send-summary'),
    path('program/<uuid:program_id>/day/<uuid:day_id>/claim/', views.ClaimFoodView.as_view(), name='claim-food'),
]