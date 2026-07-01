import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parent.parent
TEMPLATE_DIR = ROOT / "assets" / "rank_templates"


def read(name: str) -> str:
    return (ROOT / name).read_text()


def test_rank_template_assets_are_available() -> None:
    metadata = json.loads((TEMPLATE_DIR / "metadata.json").read_text())

    assert metadata["normalized_size"] == {"width": 1280, "height": 720}
    assert metadata["files"] == [f"{rank}.png" for rank in range(1, 13)]
    assert metadata["rank_roi"] == {
        "x": 558,
        "y": 52,
        "width": 68,
        "height": 38,
        "row_stride": 52,
    }
    for file_name in metadata["files"]:
        with Image.open(TEMPLATE_DIR / file_name) as image:
            assert image.size == (68, 38)


def test_capture_controls_are_present() -> None:
    html = read("index.html")

    assert 'id="startCaptureButton"' in html
    assert 'id="stopCaptureButton"' in html
    assert 'id="detectedResultImage" class="detected-result-image"' in html
    assert 'id="detectedResultPlaceholder"' in html
    assert 'id="modalResultImage" class="detected-result-image"' in html
    assert 'id="modalResultPlaceholder"' in html
    assert 'class="capture-source-mini"' in html
    assert 'id="captureVideo" class="capture-source-video" autoplay muted playsinline' in html
    assert 'id="captureCanvas"' in html
    assert 'id="detectScores"' not in html


def test_browser_detection_logic_is_present() -> None:
    script = read("app.js")

    assert "navigator.mediaDevices.getDisplayMedia" in script
    assert "await els.captureVideo.play();" in script
    assert "RANK_TEMPLATE_BASE = \"./assets/rank_templates\"" in script
    assert "RANK_SCORE_THRESHOLD = 0.62" in script
    assert "RANK_MIN_MATCHES = 10" in script
    assert "function ensureRankTemplates" in script
    assert "function detectResultScreen" in script
    assert "els.captureVideo.videoWidth === 0" in script
    assert "function showDetectedResultScreenshot" in script
    assert "capture.lastScreenshotUrl = canvas.toDataURL" in script
    assert 'openRaceInputModal("detected")' in script
    assert "style.backgroundImage" in script
    assert "canvas.toDataURL" in script
    assert "function normalizeVector" in script
    assert "function renderDetectionScores" not in script
