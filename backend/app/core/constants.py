"""Shared vocabularies.

Only enums whose vocabulary is genuinely closed become native PostgreSQL enums.
Anything expected to grow (languages, data sources, CAP event types) stays a
plain string column, because NFR-I1 and NFR-C4 both require extension by
configuration rather than schema migration.
"""

from enum import Enum


class DBEnum(str, Enum):
    """String-valued enum; `.value` is what lands in the column."""


# --- Native PostgreSQL enums -------------------------------------------------

class Verdict(DBEnum):
    """FR-E2.1 safety-to-sail outcome. Closed set, safety-critical."""
    SAFE = "safe"
    CAUTION = "caution"
    UNSAFE = "unsafe"


class ResolutionRoute(DBEnum):
    """FR-D1.2 location precedence. FR-D1.3 requires reporting which was used."""
    SHARED_POSITION = "shared_position"
    LIVE_GPS = "live_gps"
    BASE_LOCATION = "base_location"
    EXPLICIT_COORDS = "explicit_coords"
    NAMED_PLACE = "named_place"


class TurnStatus(DBEnum):
    """FR-B4.3 — a partial answer is a distinct outcome, not a failure."""
    COMPLETE = "complete"
    PARTIAL = "partial"
    CLARIFICATION_REQUESTED = "clarification_requested"
    FAILED = "failed"


class InvocationStatus(DBEnum):
    OK = "ok"
    FAILED = "failed"
    TIMED_OUT = "timed_out"
    SKIPPED = "skipped"


class PfzZoneClass(DBEnum):
    """Label vocabulary of the XGBoost model in services/pfz-api."""
    BEST = "BEST"
    GOOD = "GOOD"
    POOR = "POOR"


class GenerationStatus(DBEnum):
    """FR-E1.14 — atomic publish is a status transition, not a data copy."""
    BUILDING = "building"
    PUBLISHED = "published"
    SUPERSEDED = "superseded"
    FAILED = "failed"


class EmptyReason(DBEnum):
    """FR-E1.9 — zero zones must distinguish these two causes."""
    NO_QUALIFYING_CONDITIONS = "no_qualifying_conditions"
    INSUFFICIENT_COVERAGE = "insufficient_coverage"


class CapSeverity(DBEnum):
    """CAP 1.2 fixed vocabulary."""
    EXTREME = "Extreme"
    SEVERE = "Severe"
    MODERATE = "Moderate"
    MINOR = "Minor"
    UNKNOWN = "Unknown"


class CapUrgency(DBEnum):
    IMMEDIATE = "Immediate"
    EXPECTED = "Expected"
    FUTURE = "Future"
    PAST = "Past"
    UNKNOWN = "Unknown"


class CapCertainty(DBEnum):
    OBSERVED = "Observed"
    LIKELY = "Likely"
    POSSIBLE = "Possible"
    UNLIKELY = "Unlikely"
    UNKNOWN = "Unknown"


# --- Plain-string vocabularies (NOT DB enums) --------------------------------

class SourceId(str, Enum):
    """§5.2 external interfaces. Stored as String(32) so adding a source is
    config, not migration (NFR-C4)."""
    NASA_OBDAAC = "nasa_obdaac"
    MOSDAC = "mosdac"
    OPEN_METEO_FORECAST = "open_meteo_forecast"
    OPEN_METEO_MARINE = "open_meteo_marine"
    SACHET_CAP = "sachet_cap"
    MARINEREGIONS = "marineregions"
    WDPA = "wdpa"
    TIDE = "tide"
    PFZ_MODEL = "pfz_model"
    SALINITY_CLIMATOLOGY = "salinity_climatology"


class Language(str, Enum):
    """Convenience only. The column is String(8) — NFR-I1 forbids a code change
    to add a language."""
    ENGLISH = "en"
    HINDI = "hi"
    KANNADA = "kn"


DEFAULT_LANGUAGE = Language.ENGLISH.value
SRID = 4326