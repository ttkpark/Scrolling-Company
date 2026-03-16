"""사이트 설정 로더."""
from pathlib import Path
import yaml

_CONFIG_PATH = Path(__file__).parent / "sites.yaml"


def load_sites_config() -> dict:
    with open(_CONFIG_PATH, encoding="utf-8") as f:
        return yaml.safe_load(f)


def get_site_config(site_key: str) -> dict:
    cfg = load_sites_config()
    sites = cfg.get("sites", [])
    for s in sites:
        if s["key"] == site_key:
            return s
    raise KeyError(f"사이트 설정을 찾을 수 없습니다: {site_key}")
