from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent


def read(name: str) -> str:
    return (ROOT / name).read_text()


def test_storage_versioning_is_explicit() -> None:
    script = read("app.js")

    assert 'STORAGE_KEY = "mk-lounge-static-scorer:v1"' in script
    assert "const STORAGE_VERSION = 1" in script
    assert "parsed.version !== STORAGE_VERSION" in script
    assert "version: STORAGE_VERSION" in script


def test_race_delete_flow_is_present() -> None:
    script = read("app.js")

    assert "function deleteRace" in script
    assert "Race ${raceNo} を削除します" in script
    assert "raceNo === 1" in script
    assert "state.specimens = []" in script
    assert "releaseHeldResult();" in script


def test_history_delete_button_styles_are_present() -> None:
    styles = read("styles.css")

    assert ".history-card-header" in styles
    assert ".icon-danger-button" in styles
