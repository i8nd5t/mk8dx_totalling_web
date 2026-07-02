from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent


def read(name: str) -> str:
    return (ROOT / name).read_text()


def test_app_is_buildless_static_page() -> None:
    html = read("index.html")

    assert '<link rel="stylesheet" href="./styles.css" />' in html
    assert '<script src="./app.js"></script>' in html
    assert "ラウンジ集計ツール" in html
    assert "使い始めの流れ" in html
    assert 'data-step="capture"' in html
    assert 'data-step="first-race"' in html
    assert 'data-step="history"' in html
    assert "配信用順位表" in html
    assert "レース履歴・修正" in html
    assert "1レース目のタグ入力" in html
    assert 'id="raceInputModal"' in html
    assert 'role="dialog"' in html
    assert 'id="openManualInputButton"' in html
    assert 'id="openOverlayButton"' in html
    assert 'id="modalResultImage"' in html
    assert 'id="addRaceButton"' not in html


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

    assert "function openRaceInputModal" in script
    assert "function closeRaceInputModal" in script
    assert "function renderModalScreenshot" in script
    assert "function addRaceFromDraft" in script
    assert "function maybeAddRaceFromCompletedDraft" in script
    assert "function resetAll" in script
    assert "function openOverlayWindow" in script
    assert "function broadcastStateToOverlay" in script
    assert "function applyExternalState" in script
    assert "document.documentElement.classList.toggle" in script
    assert "view\", \"overlay\"" in script
    assert 'window.addEventListener("storage"' in script
    assert 'window.addEventListener("message"' in script
    assert "mk-lounge-state" in script
    assert "overlayWindow.postMessage" in script
    assert "let state = loadState();" in script
    assert "window.confirm" in script
    assert "12レースまで追加済み" in script
    assert "タグが未入力の順位があります" in script


def test_overlay_and_history_rendering_are_present() -> None:
    script = read("app.js")

    assert "function renderOverlay" in script
    assert "function renderQuickSteps" in script
    assert 'activeStep = "history"' in script
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
    assert "--col-score: 62px;" in styles
    assert "grid-template-columns: minmax(0, 1fr) var(--col-score);" in styles
    assert ".modal-backdrop[hidden]" in styles
    assert "html.overlay-only" in styles
    assert "body.overlay-only" in styles
    assert "body.overlay-only .scoreboard" in styles
    assert "width: 180px;" in styles
