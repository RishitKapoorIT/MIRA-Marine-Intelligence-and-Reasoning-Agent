"""FR-E2 go/no-go verdict.

A pure function over tool envelopes. No LLM is involved at any point, and no
agent may override the result — app/agents/specialists/risk_agent.py receives
a VerdictResult and explains it, which is why FR-E2.4 is a unit test in
tests/test_verdict.py rather than a line in a prompt.

The governing rule is FR-E2.4: the system shall never return SAFE when a
required input is missing. That is implemented as a hard cap applied last, so
no ordering of the threshold checks above it can defeat it.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import timedelta

from app.core.constants import CapSeverity, Verdict
from app.core.thresholds import thresholds
from app.db.models import Alert
from app.tools.base import SourceEnvelope

# Severity order for "worst wins" comparison.
_SEVERITY_RANK = {Verdict.SAFE: 0, Verdict.CAUTION: 1, Verdict.UNSAFE: 2}


@dataclass
class VerdictReason:
    """One factor that moved the verdict. FR-G1.1 / FR-E2.3 — the user is
    shown which threshold was crossed by which observed value from which
    source, not just a colour."""

    factor: str
    verdict: Verdict
    observed: float | None
    threshold: float | None
    unit: str
    source_id: str
    detail: str


@dataclass
class VerdictResult:
    verdict: Verdict
    reasons: list[VerdictReason] = field(default_factory=list)
    # FR-B4.3 / FR-E2.4 — what we could not obtain, named explicitly.
    missing_inputs: list[str] = field(default_factory=list)
    # True when the verdict was downgraded purely because of missing data
    # rather than because of an observed hazard. The distinction matters:
    # "conditions look rough" and "we cannot see the conditions" are
    # different messages and must not be collapsed into one amber badge.
    capped_by_missing_input: bool = False


def _worst(a: Verdict, b: Verdict) -> Verdict:
    return a if _SEVERITY_RANK[a] >= _SEVERITY_RANK[b] else b


def _threshold_check(
    value: float | None,
    caution_at: float,
    unsafe_at: float,
    *,
    factor: str,
    unit: str,
    source_id: str,
) -> VerdictReason | None:
    """Higher value = worse. Returns None when the value is fine or absent."""
    if value is None:
        return None

    if value >= unsafe_at:
        return VerdictReason(
            factor=factor,
            verdict=Verdict.UNSAFE,
            observed=value,
            threshold=unsafe_at,
            unit=unit,
            source_id=source_id,
            detail=f"{factor} {value}{unit} at or above the unsafe threshold {unsafe_at}{unit}",
        )
    if value >= caution_at:
        return VerdictReason(
            factor=factor,
            verdict=Verdict.CAUTION,
            observed=value,
            threshold=caution_at,
            unit=unit,
            source_id=source_id,
            detail=f"{factor} {value}{unit} at or above the caution threshold {caution_at}{unit}",
        )
    return None


def evaluate(
    marine: SourceEnvelope | None,
    weather: SourceEnvelope | None,
    alerts: list[Alert] | None = None,
    *,
    alerts_feed_available: bool = True,
) -> VerdictResult:
    """Compute the go/no-go verdict.

    Order of operations matters:
      1. record every missing required input
      2. threshold checks over whatever IS available
      3. active hazard alerts (an official warning outranks our thresholds)
      4. FR-E2.4 cap — applied last so nothing above can produce a false SAFE
    """
    cfg = thresholds.safety
    reasons: list[VerdictReason] = []
    missing: list[str] = []
    verdict = Verdict.SAFE

    # --- 1. Required inputs -------------------------------------------------

    marine_ok = marine is not None and marine.available
    weather_ok = weather is not None and weather.available

    if not marine_ok:
        detail = marine.unavailable_reason if marine is not None else "no data returned"
        missing.append(f"marine conditions (wave height) unavailable: {detail}")
    if not weather_ok:
        detail = weather.unavailable_reason if weather is not None else "no data returned"
        missing.append(f"wind forecast unavailable: {detail}")
    if not alerts_feed_available:
        # §7.8 — an unreachable hazard feed is never an all-clear.
        missing.append("official hazard alert feed unreachable")

    # FR-C6.2 — data too old to stand behind is treated as missing, not as
    # weak evidence for SAFE.
    max_age = timedelta(hours=cfg.max_forecast_age_hours)
    if marine_ok and marine.is_stale(max_age):
        missing.append(
            f"marine forecast is stale (older than {cfg.max_forecast_age_hours}h)"
        )
        marine_ok = False
    if weather_ok and weather.is_stale(max_age):
        missing.append(
            f"wind forecast is stale (older than {cfg.max_forecast_age_hours}h)"
        )
        weather_ok = False

    # --- 2. Threshold checks over available data ----------------------------

    if marine_ok:
        for reason in (
            _threshold_check(
                marine.values.get("max_wave_height_m"),
                cfg.wave_height_caution_m,
                cfg.wave_height_unsafe_m,
                factor="wave height",
                unit="m",
                source_id=marine.source_id,
            ),
            _threshold_check(
                marine.values.get("max_current_velocity_ms"),
                cfg.current_caution_ms,
                float("inf"),  # no unsafe cutoff defined for current alone
                factor="current velocity",
                unit="m/s",
                source_id=marine.source_id,
            ),
        ):
            if reason:
                reasons.append(reason)
                verdict = _worst(verdict, reason.verdict)

    if weather_ok:
        for reason in (
            _threshold_check(
                weather.values.get("max_wind_speed_ms"),
                cfg.wind_speed_caution_ms,
                cfg.wind_speed_unsafe_ms,
                factor="wind speed",
                unit="m/s",
                source_id=weather.source_id,
            ),
            _threshold_check(
                weather.values.get("max_wind_gust_ms"),
                cfg.wind_gust_caution_ms,
                cfg.wind_gust_unsafe_ms,
                factor="wind gust",
                unit="m/s",
                source_id=weather.source_id,
            ),
        ):
            if reason:
                reasons.append(reason)
                verdict = _worst(verdict, reason.verdict)

        # Visibility is inverted — lower is worse.
        visibility = weather.values.get("min_visibility_m")
        if visibility is not None and visibility <= cfg.visibility_caution_m:
            reasons.append(
                VerdictReason(
                    factor="visibility",
                    verdict=Verdict.CAUTION,
                    observed=visibility,
                    threshold=cfg.visibility_caution_m,
                    unit="m",
                    source_id=weather.source_id,
                    detail=(
                        f"visibility {visibility}m at or below the caution "
                        f"threshold {cfg.visibility_caution_m}m"
                    ),
                )
            )
            verdict = _worst(verdict, Verdict.CAUTION)

    # --- 3. Official hazard alerts ------------------------------------------
    # An agency warning outranks our own thresholds in both directions of
    # severity. FR-C4.2: these arrive by deterministic retrieval, never
    # inference.

    for alert in alerts or []:
        if alert.severity in (CapSeverity.EXTREME, CapSeverity.SEVERE):
            alert_verdict = Verdict.UNSAFE
        elif alert.severity == CapSeverity.MODERATE:
            alert_verdict = Verdict.CAUTION
        else:
            continue

        reasons.append(
            VerdictReason(
                factor="official hazard alert",
                verdict=alert_verdict,
                observed=None,
                threshold=None,
                unit="",
                source_id="sachet_cap",
                detail=(
                    f"{alert.severity.value} {alert.hazard_type} alert in force"
                    + (
                        f" from {alert.originating_agency}"
                        if alert.originating_agency
                        else ""
                    )
                ),
            )
        )
        verdict = _worst(verdict, alert_verdict)

    # --- 4. FR-E2.4 hard cap ------------------------------------------------
    # Applied last, unconditionally. Whatever the checks above concluded, an
    # incomplete picture cannot yield SAFE.

    capped = False
    if missing and verdict == Verdict.SAFE:
        verdict = Verdict.CAUTION
        capped = True

    return VerdictResult(
        verdict=verdict,
        reasons=reasons,
        missing_inputs=missing,
        capped_by_missing_input=capped,
    )