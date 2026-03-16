"""
robots.txt 확인 및 이용약관 경로 차단 유틸리티.
"""
from __future__ import annotations
import logging
from functools import lru_cache
from urllib.parse import urlparse
from urllib.robotparser import RobotFileParser

import httpx

logger = logging.getLogger(__name__)

_USER_AGENT = "Googlebot"  # robots.txt 확인 시 사용


@lru_cache(maxsize=32)
def _get_robot_parser(base_url: str) -> RobotFileParser | None:
    """robots.txt를 파싱해 캐싱합니다."""
    robots_url = base_url.rstrip("/") + "/robots.txt"
    rp = RobotFileParser()
    rp.set_url(robots_url)
    try:
        rp.read()
        return rp
    except Exception as exc:
        logger.warning("[robots.txt] 읽기 실패 (%s): %s", robots_url, exc)
        return None


def is_allowed(url: str, user_agent: str = "*") -> bool:
    """
    robots.txt 기준 해당 URL 수집 허용 여부 반환.
    robots.txt 읽기 실패 시 True(허용)로 처리합니다.
    """
    parsed = urlparse(url)
    base_url = f"{parsed.scheme}://{parsed.netloc}"
    rp = _get_robot_parser(base_url)
    if rp is None:
        return True
    allowed = rp.can_fetch(user_agent, url)
    if not allowed:
        logger.warning("[robots.txt] 수집 차단: %s", url)
    return allowed


def filter_allowed_urls(urls: list[str], user_agent: str = "*") -> list[str]:
    """URL 목록에서 robots.txt 허용 URL만 필터링."""
    return [u for u in urls if is_allowed(u, user_agent)]
