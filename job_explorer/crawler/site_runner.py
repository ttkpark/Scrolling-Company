"""
사이트 단위 수집 오케스트레이터.
브라우저 러너 + 스크롤 엔진 + 파서를 조합하여 직무 목록 → 상세 수집 수행.
"""
from __future__ import annotations
import asyncio
import logging
from typing import List

from job_explorer.crawler.browser_runner import BrowserRunner
from job_explorer.crawler.scroll_engine import ScrollEngine
from job_explorer.crawler.robots_guard import filter_allowed_urls
from job_explorer.crawler.fail_logger import record_failure
from job_explorer.parsers.base_parser import BaseParser
from job_explorer.schema.job_role import JobRole

logger = logging.getLogger(__name__)

# 단일 사이트에서 수집할 상세 페이지 최대 수 (초기 테스트 안전 제한)
_MAX_DETAILS_PER_SITE = 50


class SiteRunner:
    """
    단일 사이트의 수집을 처리합니다.
    1. 목록 페이지 접근 → 자동 스크롤 → 링크 수집
    2. 각 링크 순회 → 상세 파싱 → JobRole 반환
    """

    def __init__(self, site_config: dict, defaults: dict) -> None:
        self.cfg = site_config
        self.defaults = defaults
        self.site_key: str = site_config["key"]

    async def run(self, parser: BaseParser) -> List[JobRole]:
        """사이트 전체 수집 실행. JobRole 목록 반환."""
        headless: bool = self.defaults.get("headless", True)
        timeout_ms: int = self.defaults.get("timeout_ms", 30_000)
        delay_min: float = self.defaults.get("request_delay_min", 1.5)
        delay_max: float = self.defaults.get("request_delay_max", 4.0)
        max_retries: int = self.defaults.get("max_retries", 3)
        pause_ms: int = self.defaults.get("scroll_pause_ms", 2000)
        stabilize: int = self.defaults.get("scroll_stabilize_count", 3)
        vw: int = self.defaults.get("viewport_width", 1280)
        vh: int = self.defaults.get("viewport_height", 900)

        list_url: str = self.cfg.get("list_url", "")
        scroll_type: str = self.cfg.get("scroll_type", "infinite")

        all_jobs: List[JobRole] = []

        async with BrowserRunner(
            headless=headless,
            viewport_width=vw,
            viewport_height=vh,
            timeout_ms=timeout_ms,
            request_delay_min=delay_min,
            request_delay_max=delay_max,
        ) as browser:
            # ── 1. 목록 페이지 ──────────────────────────────
            list_page = await browser.new_page()
            logger.info("[%s] 목록 페이지 접근: %s", self.site_key, list_url)

            ok = await browser.navigate_with_retry(list_page, list_url, max_retries)
            if not ok:
                logger.error("[%s] 목록 페이지 접근 실패. 수집 중단.", self.site_key)
                return []

            # 스크롤/더보기 처리
            engine = ScrollEngine(
                list_page,
                scroll_type=scroll_type,
                pause_ms=pause_ms,
                stabilize_count=stabilize,
            )
            await engine.run()

            # 링크 추출
            detail_urls = await parser.extract_list(list_page)
            await list_page.close()

            # robots.txt 필터링
            detail_urls = filter_allowed_urls(detail_urls)

            if not detail_urls:
                logger.warning("[%s] 수집 가능한 링크가 없습니다.", self.site_key)
                return []

            # 안전 제한 적용
            if len(detail_urls) > _MAX_DETAILS_PER_SITE:
                logger.info(
                    "[%s] 링크 %d건 → 최대 %d건으로 제한",
                    self.site_key, len(detail_urls), _MAX_DETAILS_PER_SITE
                )
                detail_urls = detail_urls[:_MAX_DETAILS_PER_SITE]

            logger.info("[%s] 상세 페이지 수집 시작: %d건", self.site_key, len(detail_urls))

            # ── 2. 상세 페이지 순회 ─────────────────────────
            detail_page = await browser.new_page()
            for idx, url in enumerate(detail_urls, 1):
                logger.info("[%s] (%d/%d) %s", self.site_key, idx, len(detail_urls), url)

                ok = await browser.navigate_with_retry(detail_page, url, max_retries)
                if not ok:
                    record_failure(url, self.site_key, "navigate_failed")
                    continue

                job = await parser.extract_detail(detail_page, url)
                if job and job.job_name:
                    all_jobs.append(job)
                else:
                    record_failure(url, self.site_key, "parse_failed_or_empty")
                    logger.debug("[%s] 파싱 결과 없음: %s", self.site_key, url)

                await browser.random_delay()

            await detail_page.close()

        logger.info("[%s] 수집 완료: %d건", self.site_key, len(all_jobs))
        return all_jobs
