from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parent.parent


def read(path: str) -> str:
    return (ROOT / path).read_text()


def test_github_pages_workflow_is_present() -> None:
    workflow = read(".github/workflows/pages.yml")

    assert "Deploy static app to GitHub Pages" in workflow
    assert "actions/upload-pages-artifact" in workflow
    assert "actions/deploy-pages" in workflow
    assert 'path: "."' in workflow


def test_deployment_docs_cover_pages_hosts() -> None:
    notes = read("DEPLOYMENT.md")

    assert "GitHub Pages" in notes
    assert "Cloudflare Pages" in notes
    assert "ビルドコマンドは不要" in notes
    assert "HTTPS" in notes


def test_usage_docs_include_obs_crop_screenshot() -> None:
    usage = read("docs/USAGE.md")
    screenshot = ROOT / "docs" / "screenshots" / "overlay-crop-guide.png"

    assert "OBSクロップ例" in usage
    assert "./screenshots/overlay-crop-guide.png" in usage
    assert screenshot.exists()
    with Image.open(screenshot) as image:
        assert image.size == (1200, 720)


def test_readme_links_to_usage_and_deployment_docs() -> None:
    readme = read("README.md")

    assert "[docs/USAGE.md](./docs/USAGE.md)" in readme
    assert "[DEPLOYMENT.md](./DEPLOYMENT.md)" in readme
