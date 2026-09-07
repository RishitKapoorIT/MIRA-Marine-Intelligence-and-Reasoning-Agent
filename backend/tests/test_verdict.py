"""FR-E2 verdict tests. The FR-E2.4 cases are the ones that matter most:
a wrong SAFE is the single most dangerous output this system can produce.
"""

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from app.core.constants import CapSeverity, Verdict
from app.safety.verdict import evaluate
from app.tools.base import DataKind, SourceEnvelope

NOW = datetime.now(timezone.utc)


def marine(wave=1.0, current=0.2, valid_at=NOW, available=True):
    if not available:
        return SourceEnvelope.unavailable("open_meteo_marine", DataKind.FORECAST, "down")
    return SourceEnvelope(
        source_id="open_meteo_marine", kind=DataKind.FORECAST, valid_at=valid_at,
        values={"max_wave_height_m": wave, "max_current_velocity_ms": current},
    )


def weather(wind=5.0, gust=8.0, visibility=10000.0, valid_at=NOW, available=True):
    if not available:
        return SourceEnvelope.unavailable("open_meteo_forecast", DataKind.FORECAST, "down")
    return SourceEnvelope(
        source_id="open_meteo_forecast", kind=DataKind.FORECAST, valid_at=valid_at,
        values={"max_wind_speed_ms": wind, "max_wind_gust_ms": gust,
                "min_visibility_m": visibility},
    )


def alert(severity, hazard="Cyclonic Storm"):
    return SimpleNamespace(severity=severity, hazard_type=hazard,
                           originating_agency="IMD")


def check(label, got, want):
    assert got == want, f"{label}: got {got}, want {want}"
    print(f"  PASS  {label:52} -> {got.value.upper()}")


print("--- Calm conditions, everything available ---")
r = evaluate(marine(), weather())
check("calm sea, light wind, all data present", r.verdict, Verdict.SAFE)
assert r.missing_inputs == [] and not r.capped_by_missing_input

print("\n--- Threshold crossings ---")
check("wave 2.5m (caution 2.0)", evaluate(marine(wave=2.5), weather()).verdict, Verdict.CAUTION)
check("wave 3.5m (unsafe 3.0)", evaluate(marine(wave=3.5), weather()).verdict, Verdict.UNSAFE)
check("wind 12 m/s (caution 10)", evaluate(marine(), weather(wind=12)).verdict, Verdict.CAUTION)
check("wind 16 m/s (unsafe 15)", evaluate(marine(), weather(wind=16)).verdict, Verdict.UNSAFE)
check("gust 21 m/s (unsafe 20)", evaluate(marine(), weather(gust=21)).verdict, Verdict.UNSAFE)
check("visibility 1500m (caution 2000)", evaluate(marine(), weather(visibility=1500)).verdict, Verdict.CAUTION)
check("worst-wins: calm wave + unsafe wind", evaluate(marine(wave=0.5), weather(wind=18)).verdict, Verdict.UNSAFE)

print("\n--- Official alerts outrank our thresholds ---")
check("SEVERE alert, calm sea", evaluate(marine(), weather(), [alert(CapSeverity.SEVERE)]).verdict, Verdict.UNSAFE)
check("EXTREME alert, calm sea", evaluate(marine(), weather(), [alert(CapSeverity.EXTREME)]).verdict, Verdict.UNSAFE)
check("MODERATE alert, calm sea", evaluate(marine(), weather(), [alert(CapSeverity.MODERATE)]).verdict, Verdict.CAUTION)
check("MINOR alert does not move verdict", evaluate(marine(), weather(), [alert(CapSeverity.MINOR)]).verdict, Verdict.SAFE)

print("\n--- FR-E2.4: NEVER 'safe' when a required input is missing ---")
r = evaluate(marine(available=False), weather())
check("marine source down", r.verdict, Verdict.CAUTION)
assert r.capped_by_missing_input is True
assert any("marine" in m for m in r.missing_inputs), r.missing_inputs

r = evaluate(marine(), weather(available=False))
check("weather source down", r.verdict, Verdict.CAUTION)
assert r.capped_by_missing_input is True

r = evaluate(None, None)
check("both sources absent entirely", r.verdict, Verdict.CAUTION)
assert len(r.missing_inputs) == 2

r = evaluate(marine(), weather(), alerts_feed_available=False)
check("hazard feed unreachable", r.verdict, Verdict.CAUTION)
assert r.capped_by_missing_input is True
assert any("hazard alert feed" in m for m in r.missing_inputs)

stale = NOW - timedelta(hours=12)
r = evaluate(marine(valid_at=stale), weather(valid_at=stale))
check("data 12h stale (limit 6h)", r.verdict, Verdict.CAUTION)
assert r.capped_by_missing_input is True

r = evaluate(marine(valid_at=None), weather())
check("valid_at unknown", r.verdict, Verdict.CAUTION)

print("\n--- The cap must not mask a real hazard ---")
r = evaluate(marine(available=False), weather(wind=18))
check("missing marine + unsafe wind stays UNSAFE", r.verdict, Verdict.UNSAFE)
assert r.capped_by_missing_input is False, "cap must not fire when a real hazard set the verdict"
assert r.missing_inputs, "missing inputs must still be reported"
print("  PASS  cap did not fire; missing inputs still reported")

r = evaluate(marine(available=False), weather(available=False), [alert(CapSeverity.EXTREME)])
check("all sources down + EXTREME alert", r.verdict, Verdict.UNSAFE)

print("\n--- Exhaustive: no input combination can yield SAFE while data is missing ---")
count = 0
for m_ok in (True, False):
    for w_ok in (True, False):
        for feed in (True, False):
            for wave in (0.1, 2.5, 3.5):
                for wind in (1.0, 12.0, 18.0):
                    r = evaluate(marine(wave=wave, available=m_ok),
                                 weather(wind=wind, available=w_ok),
                                 alerts_feed_available=feed)
                    count += 1
                    if r.missing_inputs:
                        assert r.verdict != Verdict.SAFE, (m_ok, w_ok, feed, wave, wind)
print(f"  PASS  {count} combinations checked, zero produced SAFE with missing inputs")

print("\n--- Reasons cite observed value, threshold and source (FR-G1.1) ---")
r = evaluate(marine(wave=3.5), weather())
wave_reason = next(x for x in r.reasons if x.factor == "wave height")
assert wave_reason.observed == 3.5 and wave_reason.threshold == 3.0
assert wave_reason.source_id == "open_meteo_marine" and wave_reason.unit == "m"
print(f"  PASS  {wave_reason.detail}  [source: {wave_reason.source_id}]")

print("\nVERDICT TESTS PASSED")