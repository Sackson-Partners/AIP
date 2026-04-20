"""
AIP Claude API Service
----------------------
Single point of contact between the AIP backend and the Anthropic API.
All AI-powered intelligence generation flows through this service.

Usage:
    from backend.services.claude_service import call_claude, call_claude_structured
"""

import os
import logging
import httpx
from typing import Optional

logger = logging.getLogger(__name__)

ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"
ANTHROPIC_VERSION = "2023-06-01"
# Use the latest available Claude model
DEFAULT_MODEL = "claude-sonnet-4-5-20250929"


def _get_api_key() -> str:
    """Retrieve Anthropic API key from environment (Azure Key Vault reference)."""
    key = os.getenv("ANTHROPIC_API_KEY")
    if not key:
        raise EnvironmentError(
            "ANTHROPIC_API_KEY is not set. "
            "Configure it as an Azure Key Vault reference in the Container App."
        )
    return key


async def call_claude(
    prompt: str,
    max_tokens: int = 1500,
    model: str = DEFAULT_MODEL,
    system_prompt: Optional[str] = None,
) -> str:
    """
    Send a prompt to the Claude API and return the text response.

    Args:
        prompt:        The user message / analysis request.
        max_tokens:    Maximum tokens for the response (default 1500).
        model:         Claude model identifier.
        system_prompt: Optional system-level instruction for role configuration.

    Returns:
        The text content of Claude's response.

    Raises:
        httpx.HTTPStatusError: On non-2xx responses from Anthropic.
        ValueError:            If the response format is unexpected.
    """
    api_key = _get_api_key()

    messages = [{"role": "user", "content": prompt}]

    payload: dict = {
        "model": model,
        "max_tokens": max_tokens,
        "messages": messages,
    }
    if system_prompt:
        payload["system"] = system_prompt

    headers = {
        "Content-Type": "application/json",
        "x-api-key": api_key,
        "anthropic-version": ANTHROPIC_VERSION,
    }

    logger.info("Calling Claude API | model=%s | max_tokens=%d", model, max_tokens)

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(ANTHROPIC_API_URL, json=payload, headers=headers)
        response.raise_for_status()

    data = response.json()

    try:
        text = data["content"][0]["text"]
    except (KeyError, IndexError) as exc:
        logger.error("Unexpected Claude response structure: %s", data)
        raise ValueError(f"Unexpected Claude API response: {exc}") from exc

    logger.info("Claude API call successful | characters=%d", len(text))
    return text


async def call_claude_structured(
    prompt: str,
    system_prompt: str,
    max_tokens: int = 2000,
    model: str = DEFAULT_MODEL,
) -> str:
    """
    Convenience wrapper for agent-style calls with a defined system role.

    Args:
        prompt:        The user analysis request.
        system_prompt: The agent system instruction (defines the AI role).
        max_tokens:    Maximum tokens for the response.
        model:         Claude model identifier.

    Returns:
        The text content of Claude's structured response.
    """
    return await call_claude(
        prompt=prompt,
        max_tokens=max_tokens,
        model=model,
        system_prompt=system_prompt,
    )


# ---------------------------------------------------------------------------
# Pre-configured Agent System Prompts
# ---------------------------------------------------------------------------

INFRASTRUCTURE_ANALYST_SYSTEM = """You are a senior infrastructure investment analyst \
specialising in Africa. You provide rigorous, data-driven analysis of infrastructure \
projects across the continent, covering engineering, economics, financing, and logistics. \
Your responses are structured intelligence briefs suitable for investors and development \
banks."""

INVESTMENT_INTELLIGENCE_SYSTEM = """You are an expert in African infrastructure finance. \
You produce investor-grade briefs covering deal structure, risk/return profiles, and \
financing models. Your audience includes development banks, sovereign wealth funds, \
and private infrastructure funds."""

GEOPOLITICS_SYSTEM = """You are a specialist in African geopolitics and infrastructure \
diplomacy. You analyse the dynamics between China, Western powers, and African governments \
in the context of infrastructure investment, sovereignty, and regional integration."""

PODCAST_INTELLIGENCE_SYSTEM = """You are a research assistant for the Ground Truth \
Podcast, which covers African infrastructure and investment. You prepare structured \
briefing materials including guest research, discussion topics, and strategic questions."""
