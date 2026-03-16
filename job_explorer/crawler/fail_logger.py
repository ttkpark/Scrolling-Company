"""
실패 URL 로그 저장 및 재수집 큐 관리.
"""
from __future__ import annotations
import json
import logging
from datetime import datetime, timezone
from pathlib import Path

logger = logging.getLogger(__name__)

_LOG_DIR = Path("data/raw")
_FAIL_LOG_PATH = _LOG_DIR / "failed_urls.json"


def record_failure(url: str, site_key: str, reason: str) -> None:
    """실패 URL을 JSON 파일에 기록합니다."""
    _LOG_DIR.mkdir(parents=True, exist_ok=True)
    entries: list = []

    if _FAIL_LOG_PATH.exists():
        try:
            with open(_FAIL_LOG_PATH, encoding="utf-8") as f:
                entries = json.load(f)
        except Exception:
            entries = []

    entries.append({
        "url": url,
        "site_key": site_key,
        "reason": str(reason),
        "failed_at": datetime.now(timezone.utc).isoformat(),
    })

    with open(_FAIL_LOG_PATH, "w", encoding="utf-8") as f:
        json.dump(entries, f, ensure_ascii=False, indent=2)


def load_failed_urls(site_key: str | None = None) -> list[dict]:
    """실패 URL 목록을 반환 (site_key 필터 옵션)."""
    if not _FAIL_LOG_PATH.exists():
        return []
    try:
        with open(_FAIL_LOG_PATH, encoding="utf-8") as f:
            entries = json.load(f)
    except Exception:
        return []

    if site_key:
        return [e for e in entries if e.get("site_key") == site_key]
    return entries
