"""
AIP Prompt Service
------------------
Manages the AIP prompt library: loading templates from disk and injecting
dynamic data before sending to the Claude API.

The prompt library is a core intellectual asset of AIP. Each .prompt file
is a plain-text template with {variable} placeholders for data injection.

Usage:
    from backend.services.prompt_service import load_prompt, inject_data, build_prompt
"""

import os
import re
import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# Prompt library lives alongside the backend package
PROMPTS_DIR = Path(__file__).parent.parent / "prompts"


def load_prompt(prompt_name: str) -> str:
    """
    Load a prompt template from the /prompts directory.

    Args:
        prompt_name: Filename without extension (e.g. 'infrastructure_project_analysis').

    Returns:
        The raw prompt template string.

    Raises:
        FileNotFoundError: If the prompt file does not exist.
    """
    file_path = PROMPTS_DIR / f"{prompt_name}.prompt"
    if not file_path.exists():
        available = [f.stem for f in PROMPTS_DIR.glob("*.prompt")]
        raise FileNotFoundError(
            f"Prompt '{prompt_name}' not found. "
            f"Available prompts: {', '.join(sorted(available))}"
        )
    content = file_path.read_text(encoding="utf-8")
    logger.debug("Loaded prompt '%s' (%d chars)", prompt_name, len(content))
    return content


def inject_data(template: str, variables: dict[str, Any]) -> str:
    """
    Replace {variable} placeholders in a prompt template with actual values.

    Args:
        template:  The raw prompt template string.
        variables: Mapping of placeholder name → value.

    Returns:
        The populated prompt string ready to send to Claude.
    """
    result = template
    for key, value in variables.items():
        placeholder = f"{{{key}}}"
        result = result.replace(placeholder, str(value))

    # Warn if any placeholders remain unfilled
    remaining = re.findall(r"\{(\w+)\}", result)
    if remaining:
        logger.warning("Prompt has unfilled placeholders: %s", remaining)

    return result


def build_prompt(prompt_name: str, variables: dict[str, Any]) -> str:
    """
    Convenience function: load a template and inject data in one step.

    Args:
        prompt_name: Filename without extension.
        variables:   Mapping of placeholder name → value.

    Returns:
        The fully populated prompt string.
    """
    template = load_prompt(prompt_name)
    return inject_data(template, variables)


def list_available_prompts() -> list[str]:
    """Return a list of all available prompt template names."""
    if not PROMPTS_DIR.exists():
        return []
    return sorted(f.stem for f in PROMPTS_DIR.glob("*.prompt"))
