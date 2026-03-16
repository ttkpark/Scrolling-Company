"""잡코리아 파서."""
from __future__ import annotations
import logging
from datetime import datetime, timezone
from typing import List

from playwright.async_api import Page

from job_explorer.parsers.base_parser import BaseParser
from job_explorer.schema.job_role import JobRole

logger = logging.getLogger(__name__)

_BASE = "https://www.jobkorea.co.kr"


class JobkoreaParser(BaseParser):
    site_key = "jobkorea"
    site_name = "잡코리아"

    async def extract_list(self, page: Page) -> List[str]:
        """잡코리아 직무 목록에서 상세 링크 수집."""
        found: List[str] = []

        # 채용공고 상세 링크 패턴
        link_patterns = [
            "a[href*='/Recruit/GI_Read/']",
            "a[href*='/recruit/']",
            ".list-default .list-post a",
            ".card-item a",
            "a.title",
        ]
        for pattern in link_patterns:
            try:
                anchors = await page.locator(pattern).all()
                for a in anchors:
                    href = await a.get_attribute("href")
                    if href:
                        if href.startswith("http"):
                            found.append(href)
                        elif href.startswith("/"):
                            found.append(_BASE + href)
                if found:
                    break
            except Exception:
                continue

        unique = list(dict.fromkeys(found))
        logger.info("[잡코리아] 직무 링크 %d건 발견", len(unique))
        return unique

    async def extract_detail(self, page: Page, url: str) -> JobRole | None:
        try:
            sel = self.selectors

            job_name = await self._text(page, sel.get("detail_job_name", ""))
            if not job_name:
                job_name = await self._text(page, "h1, h2.title, .job_title")

            department = await self._text(page, sel.get("detail_department", ""))
            company = await self._text(page, sel.get("detail_company", ""))
            description = await self._text(page, sel.get("detail_description", ""))
            responsibilities = await self._texts(page, sel.get("detail_responsibilities", ""))
            required_skills = await self._texts(page, sel.get("detail_required_skills", ""))
            preferred_skills = await self._texts(page, sel.get("detail_preferred_skills", ""))

            if not description:
                description = await self._text(page, ".jd-detail, .recruit-detail, .view-content")
                description = description[:500] if description else ""

            # 잡코리아: 기술 태그를 별도 섹션에서 추가 수집
            if not required_skills:
                skill_els = await page.locator(".skill_list span, .tag_list span").all()
                required_skills = [
                    (await el.inner_text()).strip()
                    for el in skill_els
                    if (await el.inner_text()).strip()
                ]

            return JobRole(
                source=self.site_key,
                job_name=job_name.strip(),
                department=department.strip(),
                company=company.strip(),
                description=description.strip(),
                responsibilities=responsibilities,
                required_skills=required_skills,
                preferred_skills=preferred_skills,
                url=url,
                collected_at=datetime.now(timezone.utc).isoformat(),
            )
        except Exception as exc:
            logger.error("[잡코리아] 상세 파싱 실패 (%s): %s", url, exc)
            return None
