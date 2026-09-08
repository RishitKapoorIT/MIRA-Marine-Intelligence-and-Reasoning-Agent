"""FR-I safety disclosures, in one place.

SRS §6.9's stated reason for consolidating these is that "safety obligations
distributed across a document are the ones that get dropped in
implementation". The same holds for code, so every disclosure the system can
ever attach lives in this registry and nowhere else.

Each entry is keyed. NFR-I3 forbids hardcoded user-facing strings in
application logic; the English text here is the fallback, and
app/i18n/locales/<lang>.json supplies translations against the same keys.
Application code passes keys around, never sentences.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

from app.core.constants import Verdict


class DisclosureKey(str, Enum):
    NOT_OFFICIAL_WARNING = "disclosure.not_official_warning"
    PFZ_NOT_CERTIFIED = "disclosure.pfz_not_certified"
    PFZ_NOT_VALIDATED = "disclosure.pfz_not_validated"
    PFZ_PARTIAL_COVERAGE = "disclosure.pfz_partial_coverage"
    FORECAST_NOT_OBSERVATION = "disclosure.forecast_not_observation"
    DATA_STALE = "disclosure.data_stale"
    SOURCE_UNAVAILABLE = "disclosure.source_unavailable"
    VERDICT_CAPPED_BY_MISSING_DATA = "disclosure.verdict_capped_by_missing_data"
    ALERT_FEED_UNAVAILABLE = "disclosure.alert_feed_unavailable"
    NOT_NAVIGATIONAL = "disclosure.not_navigational"
    SEEK_OFFICIAL_CONFIRMATION = "disclosure.seek_official_confirmation"


# Fallback English text. Translations live in app/i18n/locales/<lang>.json
# against these same keys.
DISCLOSURE_TEXT: dict[DisclosureKey, str] = {
    DisclosureKey.NOT_OFFICIAL_WARNING: (
        "This is guidance from ORCA, not an official government warning. "
        "Always follow instructions from IMD, INCOIS and your local port "
        "authority."
    ),
    DisclosureKey.PFZ_NOT_CERTIFIED: (
        "Fishing zones shown are ORCA's own estimate derived from public "
        "satellite data. They are not INCOIS-certified advisories."
    ),
    DisclosureKey.PFZ_NOT_VALIDATED: (
        "The accuracy of these zones has not been formally validated against "
        "independent reference data."
    ),
    DisclosureKey.PFZ_PARTIAL_COVERAGE: (
        "The most recent fishing-zone analysis did not cover the whole coast. "
        "Areas it did not reach show no zones because none were computed "
        "there, not because none exist."
    ),
    DisclosureKey.FORECAST_NOT_OBSERVATION: (
        "These values are forecasts, not measurements. Conditions at sea can "
        "differ from any forecast."
    ),
    DisclosureKey.DATA_STALE: (
        "Some data used here is older than expected and may not reflect "
        "current conditions."
    ),
    DisclosureKey.SOURCE_UNAVAILABLE: (
        "One or more data sources could not be reached, so this answer is "
        "based on incomplete information."
    ),
    DisclosureKey.VERDICT_CAPPED_BY_MISSING_DATA: (
        "This assessment is limited because required data was missing. It is "
        "not a statement that conditions are unsafe, and not a confirmation "
        "that they are safe."
    ),
    DisclosureKey.ALERT_FEED_UNAVAILABLE: (
        "The official hazard alert feed could not be reached. There may be "
        "warnings in force that are not shown here."
    ),
    DisclosureKey.NOT_NAVIGATIONAL: (
        "Do not use ORCA for navigation. Positions and distances are "
        "approximate."
    ),
    DisclosureKey.SEEK_OFFICIAL_CONFIRMATION: (
        "Before sailing, confirm conditions with your local port authority."
    ),
}


@dataclass
class Disclosure:
    key: str
    text: str

    @classmethod
    def of(cls, key: DisclosureKey) -> Disclosure:
        return cls(key=key.value, text=DISCLOSURE_TEXT[key])


def for_answer(
    *,
    verdict: Verdict | None = None,
    capped_by_missing_input: bool = False,
    missing_inputs: list[str] | None = None,
    alerts_feed_available: bool = True,
    includes_pfz: bool = False,
    pfz_partial_coverage: bool = False,
    includes_forecast: bool = False,
    any_stale: bool = False,
) -> list[Disclosure]:
    """Assemble the disclosures an answer must carry.

    Order is deliberate: the always-on obligations come first so that a UI
    truncating the list still shows the most important ones.
    """
    keys: list[DisclosureKey] = []

    # FR-I1 — attached to every answer that gives conditions or a verdict.
    if verdict is not None or includes_forecast:
        keys.append(DisclosureKey.NOT_OFFICIAL_WARNING)

    # FR-I2 — every PFZ answer, not only the methodology page.
    if includes_pfz:
        keys.append(DisclosureKey.PFZ_NOT_CERTIFIED)
        keys.append(DisclosureKey.PFZ_NOT_VALIDATED)
        if pfz_partial_coverage:
            keys.append(DisclosureKey.PFZ_PARTIAL_COVERAGE)

    # FR-I3 — a forecast must never read as a measurement.
    if includes_forecast:
        keys.append(DisclosureKey.FORECAST_NOT_OBSERVATION)

    # FR-C6.2 / §7.8 degradation.
    if any_stale:
        keys.append(DisclosureKey.DATA_STALE)
    if missing_inputs:
        keys.append(DisclosureKey.SOURCE_UNAVAILABLE)
    if not alerts_feed_available:
        keys.append(DisclosureKey.ALERT_FEED_UNAVAILABLE)

    # FR-E2.4 — say plainly that a capped verdict is not a hazard finding.
    if capped_by_missing_input:
        keys.append(DisclosureKey.VERDICT_CAPPED_BY_MISSING_DATA)

    if verdict is not None:
        keys.append(DisclosureKey.SEEK_OFFICIAL_CONFIRMATION)

    # De-duplicate while preserving order.
    seen: set[DisclosureKey] = set()
    ordered = [k for k in keys if not (k in seen or seen.add(k))]
    return [Disclosure.of(k) for k in ordered]