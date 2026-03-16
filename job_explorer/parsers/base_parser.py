"""파서 공통 인터페이스."""
from __future__ import annotations
from abc import ABC, abstractmethod
from typing import List

from playwright.async_api import Page

from job_explorer.schema.job_role import JobRole


class BaseParser(ABC):
    """
    사이트별 파서가 반드시 구현해야 하는 인터페이스.
    - extract_list: 목록 페이지에서 직무 링크(URL) 목록 추출
    - extract_detail: 상세 페이지에서 JobRole 데이터 추출
    """

    site_key: str = ""
    site_name: str = ""

    def __init__(self, config: dict) -> None:
        """
        config: sites.yaml에서 해당 사이트 항목 딕셔너리
        """
        self.config = config
        self.selectors: dict = config.get("selectors", {})

    @abstractmethod
    async def extract_list(self, page: Page) -> List[str]:
        """
        목록 페이지(page)에서 직무 상세 페이지 URL 리스트를 반환.
        """

    @abstractmethod
    async def extract_detail(self, page: Page, url: str) -> JobRole | None:
        """
        상세 페이지(page, 이미 이동 완료 상태)에서 JobRole 객체를 반환.
        파싱 실패 시 None 반환.
        """

    # ------------------------------------------------------------------
    # 공통 유틸리티
    # ------------------------------------------------------------------
    async def _text(self, page: Page, selector: str, default: str = "") -> str:
        """단일 요소 텍스트 추출."""
        if not selector:
            return default
        try:
            el = page.locator(selector).first
            if await el.count() > 0:
                return (await el.inner_text()).strip()
        except Exception:
            pass
        return default

    async def _texts(self, page: Page, selector: str) -> List[str]:
        """복수 요소 텍스트 리스트 추출."""
        if not selector:
            return []
        try:
            els = page.locator(selector)
            count = await els.count()
            results = []
            for i in range(count):
                txt = (await els.nth(i).inner_text()).strip()
                if txt:
                    results.append(txt)
            return results
        except Exception:
            return []

    async def _hrefs(self, page: Page, selector: str, base_url: str = "") -> List[str]:
        """링크(href) 리스트 추출."""
        if not selector:
            return []
        try:
            els = page.locator(selector)
            count = await els.count()
            hrefs = []
            for i in range(count):
                href = await els.nth(i).get_attribute("href")
                if href:
                    if href.startswith("http"):
                        hrefs.append(href)
                    elif href.startswith("/") and base_url:
                        hrefs.append(base_url.rstrip("/") + href)
                    else:
                        hrefs.append(href)
            return list(dict.fromkeys(hrefs))  # 순서 유지 중복 제거
        except Exception:
            return []
