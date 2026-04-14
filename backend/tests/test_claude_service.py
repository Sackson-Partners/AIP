"""
Tests for backend/services/claude_service.py
Mocks httpx — never calls the real Anthropic API.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch


def make_mock_response(text: str = "Test response text"):
    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json.return_value = {
        "content": [{"text": text, "type": "text"}],
        "model": "claude-sonnet-4-5",
        "stop_reason": "end_turn",
    }
    return mock_resp


class TestCallClaude:
    @pytest.mark.asyncio
    async def test_call_claude_returns_text(self, monkeypatch):
        monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key-for-tests")
        from backend.services.claude_service import call_claude

        mock_resp = make_mock_response("Intelligence brief for test project")

        with patch("backend.services.claude_service.httpx.AsyncClient") as mock_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client.post = AsyncMock(return_value=mock_resp)
            mock_cls.return_value = mock_client

            result = await call_claude("Analyse this African railway project")

        assert result == "Intelligence brief for test project"

    @pytest.mark.asyncio
    async def test_call_claude_with_system_prompt(self, monkeypatch):
        monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key-for-tests")
        from backend.services.claude_service import call_claude

        mock_resp = make_mock_response("Structured response")

        with patch("backend.services.claude_service.httpx.AsyncClient") as mock_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client.post = AsyncMock(return_value=mock_resp)
            mock_cls.return_value = mock_client

            result = await call_claude("Prompt", system_prompt="You are an analyst")

        assert result == "Structured response"
        call_kwargs = mock_client.post.call_args[1]
        assert "system" in call_kwargs.get("json", {})

    @pytest.mark.asyncio
    async def test_call_claude_raises_without_api_key(self, monkeypatch):
        monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
        import importlib
        import backend.services.claude_service as cs
        importlib.reload(cs)

        with pytest.raises(EnvironmentError, match="ANTHROPIC_API_KEY"):
            await cs.call_claude("test prompt")

    @pytest.mark.asyncio
    async def test_call_claude_handles_malformed_response(self, monkeypatch):
        monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key-for-tests")
        from backend.services.claude_service import call_claude

        mock_resp = MagicMock()
        mock_resp.raise_for_status = MagicMock()
        mock_resp.json.return_value = {"unexpected_key": "no content array"}

        with patch("backend.services.claude_service.httpx.AsyncClient") as mock_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client.post = AsyncMock(return_value=mock_resp)
            mock_cls.return_value = mock_client

            with pytest.raises(ValueError, match="Unexpected Claude API response"):
                await call_claude("test prompt")


class TestCallClaudeStructured:
    @pytest.mark.asyncio
    async def test_structured_call_delegates_to_call_claude(self, monkeypatch):
        monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key-for-tests")

        with patch("backend.services.claude_service.call_claude", new_callable=AsyncMock) as mock_cc:
            mock_cc.return_value = "Structured output"
            from backend.services.claude_service import call_claude_structured

            result = await call_claude_structured(
                prompt="Analyse risk",
                system_prompt="You are a risk analyst",
            )

        assert result == "Structured output"
        mock_cc.assert_called_once()
        call_kwargs = mock_cc.call_args[1]
        assert call_kwargs.get("system_prompt") == "You are a risk analyst"


class TestSystemPromptConstants:
    def test_infrastructure_analyst_system_defined(self):
        from backend.services.claude_service import INFRASTRUCTURE_ANALYST_SYSTEM
        assert isinstance(INFRASTRUCTURE_ANALYST_SYSTEM, str)
        assert len(INFRASTRUCTURE_ANALYST_SYSTEM) > 50

    def test_investment_intelligence_system_defined(self):
        from backend.services.claude_service import INVESTMENT_INTELLIGENCE_SYSTEM
        assert isinstance(INVESTMENT_INTELLIGENCE_SYSTEM, str)

    def test_geopolitics_system_defined(self):
        from backend.services.claude_service import GEOPOLITICS_SYSTEM
        assert isinstance(GEOPOLITICS_SYSTEM, str)

    def test_podcast_intelligence_system_defined(self):
        from backend.services.claude_service import PODCAST_INTELLIGENCE_SYSTEM
        assert isinstance(PODCAST_INTELLIGENCE_SYSTEM, str)
