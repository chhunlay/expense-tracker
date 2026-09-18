"""
Every User gets a Profile automatically, right when they're created -
registration (views.register) creates the User via Django's own
UserCreationForm, which knows nothing about our Profile model, so this
fills the gap instead of duplicating profile-creation logic in every
place a User might get created (registration, createsuperuser, admin).
"""
from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Profile


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def create_profile(sender, instance, created, **kwargs):
    if created:
        Profile.objects.get_or_create(user=instance)
