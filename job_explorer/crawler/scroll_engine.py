"""
자동 스크롤 엔진.
- infinite scroll: scrollHeight 안정화 감지 기반 종료
- load_more: "더보기" 버튼 클릭 후 무한스크롤 폴백
- pagination: 페이지 번호/다음 버튼 클릭
"""
from __future__ import annotations
import asyncio
import logging
from typing import Optional

from playwright.async_api import Page

logger = logging.getLogger(__name__)


class ScrollEngine:
    """
    사이트 유형별 스크롤/로드 전략을 선택해 모든 콘텐츠를 로드합니다.

    사용 예:
        engine = ScrollEngine(page, scroll_type="infinite", pause_ms=2000, stabilize_count=3)
        await engine.run()
    """

    def __init__(
        self,
        page: Page,
        scroll_type: str = "infinite",  # infinite | load_more | pagination
        pause_ms: int = 2000,
        stabilize_count: int = 3,
        load_more_selector: str = "",
        next_page_selector: str = "",
        max_pages: int = 20,
    ) -> None:
        self.page = page
        self.scroll_type = scroll_type
        self.pause_ms = pause_ms
        self.stabilize_count = stabilize_count
        self.load_more_selector = load_more_selector
        self.next_page_selector = next_page_selector
        self.max_pages = max_pages

    async def run(self) -> None:
        """스크롤 유형에 따라 적절한 전략 실행."""
        if self.scroll_type == "infinite":
            await self._infinite_scroll()
        elif self.scroll_type == "load_more":
            await self._load_more()
        elif self.scroll_type == "pagination":
            await self._paginate()
        else:
            logger.warning("알 수 없는 scroll_type: %s → infinite로 대체", self.scroll_type)
            await self._infinite_scroll()

    # ------------------------------------------------------------------
    # 전략 1: 무한 스크롤
    # ------------------------------------------------------------------
    async def _infinite_scroll(self) -> None:
        """
        scrollHeight가 stabilize_count 연속으로 변하지 않을 때까지 스크롤.
        페이지 하단에 도달하거나 새 콘텐츠가 로드되지 않으면 종료.
        """
        stable = 0
        prev_height: int = 0
        scroll_count = 0

        logger.info("[무한스크롤] 시작")
        while stable < self.stabilize_count:
            # 현재 높이 측정
            cur_height: int = await self.page.evaluate("document.body.scrollHeight")

            if cur_height == prev_height:
                stable += 1
                logger.debug("[무한스크롤] 높이 동일 %d → stable=%d", cur_height, stable)
            else:
                stable = 0
                scroll_count += 1
                logger.debug("[무한스크롤] 새 콘텐츠 로드 (스크롤 %d, 높이 %d→%d)", scroll_count, prev_height, cur_height)

            prev_height = cur_height
            await self.page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            await asyncio.sleep(self.pause_ms / 1000)

        logger.info("[무한스크롤] 완료. 총 스크롤 횟수: %d", scroll_count)

    # ------------------------------------------------------------------
    # 전략 2: 더보기 버튼
    # ------------------------------------------------------------------
    async def _load_more(self) -> None:
        """
        지정된 CSS 선택자의 "더보기" 버튼을 반복 클릭.
        버튼이 사라지거나 클릭 불가 상태가 되면 infinite_scroll로 폴백.
        """
        clicked = 0
        logger.info("[더보기] 시작 (선택자: %s)", self.load_more_selector or "없음")

        while True:
            btn = await self._find_load_more_button()
            if btn is None:
                logger.info("[더보기] 버튼 없음 → 무한스크롤로 전환")
                await self._infinite_scroll()
                break

            try:
                await btn.scroll_into_view_if_needed()
                await btn.click()
                clicked += 1
                logger.debug("[더보기] 클릭 %d회", clicked)
                await asyncio.sleep(self.pause_ms / 1000)
            except Exception as exc:
                logger.warning("[더보기] 클릭 실패: %s → 무한스크롤로 전환", exc)
                await self._infinite_scroll()
                break

    async def _find_load_more_button(self):
        """더보기 버튼을 다양한 선택자로 탐색."""
        # 사용자 지정 선택자 우선
        if self.load_more_selector:
            btn = self.page.locator(self.load_more_selector).first
            if await btn.count() > 0 and await btn.is_visible():
                return btn

        # 공통 더보기 버튼 텍스트 패턴
        more_patterns = [
            "button:has-text('더보기')",
            "button:has-text('더 보기')",
            "a:has-text('더보기')",
            "button:has-text('Load More')",
            "button:has-text('Show More')",
            "[class*=load-more]",
            "[class*=btn_more]",
            "[class*=more_btn]",
        ]
        for pattern in more_patterns:
            try:
                btn = self.page.locator(pattern).first
                if await btn.count() > 0 and await btn.is_visible():
                    return btn
            except Exception:
                continue
        return None

    # ------------------------------------------------------------------
    # 전략 3: 페이지네이션
    # ------------------------------------------------------------------
    async def _paginate(self) -> None:
        """다음 페이지 버튼을 클릭하거나 페이지 번호를 순환."""
        logger.info("[페이지네이션] 시작 (최대 %d 페이지)", self.max_pages)

        for page_num in range(1, self.max_pages + 1):
            logger.debug("[페이지네이션] 페이지 %d 처리 중", page_num)
            # 현재 페이지에서 스크롤(lazy load 대응)
            await self._scroll_current_page()

            # 다음 페이지 버튼 탐색
            next_btn = await self._find_next_button()
            if next_btn is None:
                logger.info("[페이지네이션] 마지막 페이지 도달 (페이지 %d)", page_num)
                break
            try:
                await next_btn.scroll_into_view_if_needed()
                await next_btn.click()
                await asyncio.sleep(self.pause_ms / 1000)
            except Exception as exc:
                logger.warning("[페이지네이션] 다음 페이지 클릭 실패: %s", exc)
                break

    async def _scroll_current_page(self) -> None:
        """현재 페이지 내 lazy load 처리를 위한 단순 스크롤."""
        prev_height = 0
        stable = 0
        while stable < 2:
            cur_height: int = await self.page.evaluate("document.body.scrollHeight")
            if cur_height == prev_height:
                stable += 1
            else:
                stable = 0
            prev_height = cur_height
            await self.page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            await asyncio.sleep(self.pause_ms / 1000)

    async def _find_next_button(self):
        """다음 페이지 버튼/링크를 탐색."""
        if self.next_page_selector:
            btn = self.page.locator(self.next_page_selector).first
            if await btn.count() > 0 and await btn.is_visible():
                return btn

        next_patterns = [
            "a:has-text('다음')",
            "button:has-text('다음')",
            "a.paging_next",
            "a[class*=next]",
            "button[class*=next]",
            ".pagination .next a",
            "[aria-label='다음 페이지']",
            "[aria-label='Next']",
        ]
        for pattern in next_patterns:
            try:
                btn = self.page.locator(pattern).first
                if await btn.count() > 0 and await btn.is_visible():
                    # 비활성(disabled) 상태 제외
                    is_disabled = await btn.get_attribute("disabled")
                    aria_disabled = await btn.get_attribute("aria-disabled")
                    if is_disabled is None and aria_disabled != "true":
                        return btn
            except Exception:
                continue
        return None
