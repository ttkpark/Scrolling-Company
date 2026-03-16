"""사람인 파서."""
from __future__ import annotations
import logging
from datetime import datetime, timezone
from typing import List

from playwright.async_api import Page

from job_explorer.parsers.base_parser import BaseParser
from job_explorer.schema.job_role import JobRole

logger = logging.getLogger(__name__)

_BASE = "https://www.saramin.co.kr"


class SaraminParser(BaseParser):
    site_key = "saramin"
    site_name = "사람인"

    async def extract_list(self, page: Page) -> List[str]:
        found: List[str] = []

        link_patterns = [
            "h2.job_tit a",
            ".job_tit a",
            "a[href*='/zf_user/jobs/relay/view']",
            ".item_recruit a.str_tit",
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
        logger.info("[사람인] 직무 링크 %d건 발견", len(unique))
        return unique

    async def extract_detail(self, page: Page, url: str) -> JobRole | None:
        try:
            sel = self.selectors

            job_name = await self._text(page, sel.get("detail_job_name", ""))
            if not job_name:
                job_name = await self._text(page, "h1.tit_job, .recruit_title h1, .job_header h1")

            department = await self._text(page, sel.get("detail_department", ""))
            company = await self._text(page, sel.get("detail_company", ""))
            description = await self._text(page, sel.get("detail_description", ""))

            # 사람인 직무 요약 섹션 (업직종 태그)
            job_categories = await self._texts(page, ".job_category span, .job_sector span")
            required_skills = job_categories

            responsibilities = await self._texts(page, sel.get("detail_responsibilities", ""))
            preferred_skills = await self._texts(page, sel.get("detail_preferred_skills", ""))

            if not description:
                description = await self._text(page, ".wrap_jd, .jd-contents")
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
                url=url,
                collected_at=datetime.now(timezone.utc).isoformat(),
            )
        except Exception as exc:
            logger.error("[사람인] 상세 파싱 실패 (%s): %s", url, exc)
            return None
