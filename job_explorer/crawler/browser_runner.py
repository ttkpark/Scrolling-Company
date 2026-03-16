"""
Playwright 브라우저 러너.
단일 브라우저 컨텍스트를 생성하고 페이지를 관리합니다.
"""
from __future__ import annotations
import asyncio
import logging
import random
from typing import Optional

from playwright.async_api import (
    async_playwright,
    Browser,
    BrowserContext,
    Page,
    Playwright,
)

logger = logging.getLogger(__name__)

# 실제 브라우저처럼 보이는 User-Agent
_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/122.0.0.0 Safari/537.36"
)


class BrowserRunner:
    """
    Playwright 기반 브라우저 세션 관리 클래스.
    async context manager 형태로 사용합니다.

    사용 예:
        async with BrowserRunner(headless=True) as runner:
            page = await runner.new_page()
            await page.goto("https://example.com")
    """

    def __init__(
        self,
        headless: bool = True,
        viewport_width: int = 1280,
        viewport_height: int = 900,
        timeout_ms: int = 30_000,
        request_delay_min: float = 1.5,
        request_delay_max: float = 4.0,
    ) -> None:
        self.headless = headless
        self.viewport = {"width": viewport_width, "height": viewport_height}
        self.timeout_ms = timeout_ms
        self.delay_min = request_delay_min
        self.delay_max = request_delay_max

        self._playwright: Optional[Playwright] = None
        self._browser: Optional[Browser] = None
        self._context: Optional[BrowserContext] = None

    async def __aenter__(self) -> "BrowserRunner":
        self._playwright = await async_playwright().start()
        self._browser = await self._playwright.chromium.launch(headless=self.headless)
        self._context = await self._browser.new_context(
            user_agent=_USER_AGENT,
            viewport=self.viewport,
            # 한국 로케일/시간대 설정
            locale="ko-KR",
            timezone_id="Asia/Seoul",
            # navigator.webdriver = false 처리
            java_script_enabled=True,
        )
        # 봇 감지 우회: navigator.webdriver 제거
        await self._context.add_init_script(
            "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
        )
        self._context.set_default_timeout(self.timeout_ms)
        logger.info("브라우저 컨텍스트 준비 완료 (headless=%s)", self.headless)
        return self

    async def __aexit__(self, *_) -> None:
        if self._context:
            await self._context.close()
        if self._browser:
            await self._browser.close()
        if self._playwright:
            await self._playwright.stop()
        logger.info("브라우저 종료")

    async def new_page(self) -> Page:
        """새 페이지를 생성합니다."""
        if self._context is None:
            raise RuntimeError("BrowserRunner가 초기화되지 않았습니다. async with 블록 안에서 사용하세요.")
        return await self._context.new_page()

    async def random_delay(self) -> None:
        """요청 간 랜덤 대기 (봇 감지 방지)."""
        delay = random.uniform(self.delay_min, self.delay_max)
        logger.debug("대기 중... %.1f초", delay)
        await asyncio.sleep(delay)

    async def navigate_with_retry(
        self,
        page: Page,
        url: str,
        max_retries: int = 3,
    ) -> bool:
        """
        페이지 이동을 재시도 로직과 함께 수행합니다.
        반환값: 성공 여부 (bool)
        """
        for attempt in range(1, max_retries + 1):
            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=self.timeout_ms)
                await self.random_delay()
                logger.debug("페이지 이동 성공: %s (시도 %d)", url, attempt)
                return True
            except Exception as exc:
                wait = 2 ** attempt
                logger.warning(
                    "페이지 이동 실패 (시도 %d/%d): %s → %s. %.0f초 후 재시도",
                    attempt, max_retries, url, exc, wait
                )
                if attempt < max_retries:
                    await asyncio.sleep(wait)
        logger.error("최종 실패: %s", url)
        return False
