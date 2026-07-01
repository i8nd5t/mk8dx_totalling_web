from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent


def read(name: str) -> str:
    return (ROOT / name).read_text()


def test_app_is_buildless_static_page() -> None:
    html = read("index.html")

    assert '<link rel="stylesheet" href="./styles.css" />' in html
    assert '<script src="./app.js"></script>' in html
    assert "Overlay Preview" in html
    assert "Race History" in html
    assert "レース結果入力" in html


def test_milestone1_state_and_scoring_are_present() -> None:
    script = read("app.js")

    assert 'STORAGE_KEY = "mk-lounge-static-scorer:v1"' in script
    assert "const MAX_RACES = 12" in script
    assert "1: 15" in script
    assert "12: 1" in script
    assert "function rankingFromRaces" in script
    assert "function validateEntries" in script
    assert "localStorage.setItem" in script


def test_manual_flow_and_reset_are_present() -> None:
    script = read("app.js")

    assert "function addRaceFromDraft" in script
    assert "function resetAll" in script
    assert "window.confirm" in script
    assert "12レースまで追加済み" in script
    assert "タグが未入力の順位があります" in script


def test_overlay_and_history_rendering_are_present() -> None:
    script = read("app.js")

    assert "function renderOverlay" in script
    assert "function renderHistory" in script
    assert "team-row" in script
    assert "rank-gap" in script
    assert "history-card" in script
    assert "own-team" in script


def test_overlay_crop_area_has_stable_dimensions() -> None:
    styles = read("styles.css")

    assert ".overlay-surface" in styles
    assert "width: 400px;" in styles
    assert "min-height: 690px;" in styles
    assert ".app-shell" in styles
    assert "grid-template-columns: minmax(780px, 1fr) 430px;" in styles
    assert "--col-score: 58px;" in styles
    assert "grid-template-columns: minmax(0, 1fr) var(--col-score);" in styles
