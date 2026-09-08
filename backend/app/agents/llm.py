"""Groq LLM access, with schema validation as the contract boundary.

Groq's JSON mode is less strict than some providers', and FR-B3.3 requires
all agent I/O to be schema-conforming JSON. So nothing here returns raw model
text: every call is validated against a Pydantic model, retried once with the
validation error fed back, and then gives up.

Giving up returns None rather than raising. The caller records the invocation
as SKIPPED and the graph continues with a partial answer (FR-B4.3), because
one specialist emitting unparseable JSON should degrade the answer, not lose
the whole turn.
"""

from __future__ import annotations

import json
import logging
from typing import TypeVar

from groq import AsyncGroq
from pydantic import BaseModel, ValidationError

from app.core.config import settings

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)

MAX_VALIDATION_ATTEMPTS = 2  # initial call + one corrective retry

_client: AsyncGroq | None = None


def get_client() -> AsyncGroq:
    global _client
    if _client is None:
        _client = AsyncGroq(api_key=settings.groq_api_key)
    return _client


async def call_json(
    system_prompt: str,
    user_prompt: str,
    schema: type[T],
    *,
    temperature: float = 0.0,
    max_tokens: int = 1024,
) -> tuple[T | None, str | None]:
    """Return (validated_model, error). Never raises on model misbehaviour.

    temperature defaults to 0: these calls are planning and summarisation
    over retrieved facts, where variation is a liability rather than a
    feature.
    """
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]
    last_error: str | None = None

    for attempt in range(MAX_VALIDATION_ATTEMPTS):
        try:
            response = await get_client().chat.completions.create(
                model=settings.groq_model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                response_format={"type": "json_object"},
            )
            raw = response.choices[0].message.content or ""
        except Exception as exc:  # transport, auth, rate limit
            logger.warning("Groq call failed: %s", exc)
            return None, f"LLM call failed: {exc}"

        try:
            return schema.model_validate_json(raw), None
        except ValidationError as exc:
            last_error = f"Schema validation failed: {exc.error_count()} error(s)"
            logger.warning("%s (attempt %d)", last_error, attempt + 1)

            if attempt < MAX_VALIDATION_ATTEMPTS - 1:
                # Feed the failure back rather than re-rolling blindly.
                messages.append({"role": "assistant", "content": raw})
                messages.append(
                    {
                        "role": "user",
                        "content": (
                            "That response did not match the required schema. "
                            f"Errors: {exc}\n\n"
                            "Reply with valid JSON matching the schema exactly. "
                            "Output JSON only, with no surrounding text."
                        ),
                    }
                )
        except json.JSONDecodeError as exc:
            last_error = f"Response was not valid JSON: {exc}"
            logger.warning(last_error)
            if attempt < MAX_VALIDATION_ATTEMPTS - 1:
                messages.append({"role": "assistant", "content": raw})
                messages.append(
                    {"role": "user", "content": "Output valid JSON only, nothing else."}
                )

    return None, last_error


async def call_text_stream(
    system_prompt: str,
    user_prompt: str,
    *,
    temperature: float = 0.2,
    max_tokens: int = 1024,
):
    """Yield answer text as it is generated.

    Used only by the synthesizer. Yields ("delta", chunk) for each token
    group, then ("done", full_text) or ("error", message). The caller
    accumulates the deltas, so a mid-stream failure still leaves whatever was
    produced rather than losing the turn.
    """
    try:
        stream = await get_client().chat.completions.create(
            model=settings.groq_model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=temperature,
            max_tokens=max_tokens,
            stream=True,
        )
    except Exception as exc:
        logger.warning("Groq stream failed to open: %s", exc)
        yield "error", f"LLM call failed: {exc}"
        return

    parts: list[str] = []
    try:
        async for chunk in stream:
            delta = chunk.choices[0].delta.content if chunk.choices else None
            if delta:
                parts.append(delta)
                yield "delta", delta
    except Exception as exc:
        logger.warning("Groq stream broke mid-response: %s", exc)
        if parts:
            # Partial prose beats no prose; the caller decides what to do.
            yield "done", "".join(parts)
        else:
            yield "error", f"LLM stream failed: {exc}"
        return

    yield "done", "".join(parts)


async def call_text(
    system_prompt: str,
    user_prompt: str,
    *,
    temperature: float = 0.2,
    max_tokens: int = 1024,
) -> tuple[str | None, str | None]:
    """Free-text generation, used only by the synthesizer where the output is
    prose for the user rather than a contract between components."""
    try:
        response = await get_client().chat.completions.create(
            model=settings.groq_model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=temperature,
            max_tokens=max_tokens,
        )
        return (response.choices[0].message.content or "").strip(), None
    except Exception as exc:
        logger.warning("Groq text call failed: %s", exc)
        return None, f"LLM call failed: {exc}"