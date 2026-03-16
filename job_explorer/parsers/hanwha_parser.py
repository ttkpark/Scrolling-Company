"""한화인 파서."""
from __future__ import annotations
import logging
from datetime import datetime, timezone
from typing import List

from playwright.async_api import Page

from job_explorer.parsers.base_parser import BaseParser
from job_explorer.schema.job_role import JobRole

logger = logging.getLogger(__name__)

_BASE = "https://www.hanwhain.com"
_LIST_URL = "https://www.hanwhain.com/hanwha/think/think_introduce.do"


class HanwhaParser(BaseParser):
    site_key = "hanwha"
    site_name = "한화인"

    async def extract_list(self, page: Page) -> List[str]:
        """한화인 직무 목록 페이지에서 상세 링크 수집."""
        # 계열사별 탭/링크를 클릭하며 수집하기 위해 anchor 태그 전체 탐색
        found: List[str] = []

        # 직무 링크 패턴: think_introduce_job_detail.do
        anchors = await page.locator("a[href*='think_introduce_job_detail'], a[href*='job_detail']").all()
        for a in anchors:
            href = await a.get_attribute("href")
            if href:
                if href.startswith("http"):
                    found.append(href)
                elif href.startswith("/"):
                    found.append(_BASE + href)

        # 중복 제거 후 반환
        unique = list(dict.fromkeys(found))
        logger.info("[한화인] 직무 링크 %d건 발견", len(unique))
        return unique

    async def extract_detail(self, page: Page, url: str) -> JobRole | None:
        try:
            sel = self.selectors

            job_name = await self._text(page, sel.get("detail_job_name", ""))
            if not job_name:
                # fallback: 첫 번째 h2 또는 h1 텍스트
                job_name = await self._text(page, "h2, h1")

            department = await self._text(page, sel.get("detail_department", ""))
            company = await self._text(page, sel.get("detail_company", ""))
            if not company:
                company = "한화"

            description = await self._text(page, sel.get("detail_description", ""))
            responsibilities = await self._texts(page, sel.get("detail_responsibilities", ""))
            required_skills = await self._texts(page, sel.get("detail_required_skills", ""))
            preferred_skills = await self._texts(page, sel.get("detail_preferred_skills", ""))
            career_path = await self._text(page, sel.get("detail_career_path", ""))

            # 설명이 없으면 페이지 전체 텍스트의 일부 사용
            if not description:
                description = await self._text(page, ".cont_wrap, .content_wrap, main")
                description = description[:500] if description else ""

            return JobRole(
                source=self.site_key,
                job_name=job_name.strip(),
                department=department.strip(),
                company=company.strip(),
                description=description.strip(),
                responsibilities=responsibilities,
                required_skills=required_skills,
                preferred_skills=preferred_skills,
                career_path=career_path.strip(),
                url=url,
                collected_at=datetime.now(timezone.utc).isoformat(),
            )
        except Exception as exc:
            logger.error("[한화인] 상세 파싱 실패 (%s): %s", url, exc)
            return None
