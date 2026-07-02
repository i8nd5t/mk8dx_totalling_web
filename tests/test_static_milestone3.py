from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent


def read(name: str) -> str:
    return (ROOT / name).read_text()


def test_specimen_controls_are_present() -> None:
    html = read("index.html")

    assert 'id="specimenStatus"' in html
    assert 'id="buildSpecimensButton"' not in html
    assert 'id="pendingMatchPanel"' not in html
    assert 'id="addPendingRaceButton"' not in html
    assert 'id="clearPendingRaceButton"' not in html


def test_name_feature_extraction_constants_match_ocr_layout() -> None:
    script = read("app.js")

    assert "const NAME_X = 678" in script
    assert "const NAME_Y = 62" in script
    assert "const NAME_WIDTH = 230" in script
    assert "const NAME_HEIGHT = 25" in script
    assert "const NAME_ROW_STRIDE = 52" in script
    assert "const FEATURE_WIDTH = NAME_WIDTH * 2" in script
    assert "const FEATURE_HEIGHT = NAME_HEIGHT * 2" in script
    assert "const YELLOW_ROW_POINT_THRESHOLD = 100" in script


def test_specimen_and_matching_flow_is_present() -> None:
    script = read("app.js")

    assert "function maybeBuildFirstRaceSpecimens" in script
    assert "const RESULT_PROCESS_COOLDOWN_MS = 90000" in script
    assert "capture.heldResult = true" in script
    assert "function isResultProcessingLocked" in script
    assert "function startResultCooldown" in script
    assert "function releaseHeldResult" in script
    assert "buildSpecimensButton" not in script
    assert "function extractNameFeatures" in script
    assert "function featureFromNameImageData" in script
    assert "function burnImageData" in script
    assert "function overlayBlend" in script
    assert "function isYellowNameImageData" in script
    assert "function matchFeatures" in script
    assert "function addMatchedRace" in script
    assert "function maximizeAssignment" in script
    assert "function uint8ToBase64" in script
    assert "function base64ToUint8" in script
    assert "state.pendingMatch" not in script


def test_first_race_edits_update_specimen_teams() -> None:
    script = read("app.js")

    assert "function syncSpecimenTeamsFromFirstRace" in script
    assert "if (race.raceNo === 1)" in script
