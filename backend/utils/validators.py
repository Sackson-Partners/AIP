"""Shared validation utilities for the AIP platform."""

import re

from fastapi import HTTPException


def validate_password_complexity(password: str) -> None:
    """
    Enforce password complexity rules. Raises HTTPException(400) on failure.
    Rules: min 8 chars, uppercase, lowercase, digit, special character.
    """
    errors = []
    if len(password) < 8:
        errors.append("at least 8 characters")
    if not re.search(r"[A-Z]", password):
        errors.append("one uppercase letter")
    if not re.search(r"[a-z]", password):
        errors.append("one lowercase letter")
    if not re.search(r"\d", password):
        errors.append("one digit")
    if not re.search(r"[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>/?`~]", password):
        errors.append("one special character")
    if errors:
        raise HTTPException(
            status_code=400,
            detail=f"Password must contain: {', '.join(errors)}",
        )
