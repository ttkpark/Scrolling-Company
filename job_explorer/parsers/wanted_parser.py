"""원티드 파서."""
from __future__ import annotations
import logging
from datetime import datetime, timezone
from typing import List

from playwright.async_api import Page

from job_explorer.parsers.base_parser import BaseParser
from job_explorer.schema.job_role import JobRole

logger = logging.getLogger(__name__)

_BASE = "https://www.wanted.co.kr"


class WantedParser(BaseParser):
    site_key = "wanted"
    site_name = "원티드"

    async def extract_list(self, page: Page) -> List[str]:
        found: List[str] = []

        link_patterns = [
            "a[href*='/wd/']",
            "li[class*=JobCard] a",
            ".JobCard_container__REty1 a",
            "a[href*='/jobs/']",
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
        logger.info("[원티드] 직무 링크 %d건 발견", len(unique))
        return unique

    async def extract_detail(self, page: Page, url: str) -> JobRole | None:
        try:
            sel = self.selectors

            job_name = await self._text(page, sel.get("detail_job_name", ""))
            if not job_name:
                job_name = await self._text(page, "h1, h2[class*=JobHeader]")

            department_tags = await self._texts(page, sel.get("detail_department", ""))
            department = ", ".join(department_tags[:3]) if department_tags else ""

            company = await self._text(page, sel.get("detail_company", ""))
            description = await self._text(page, sel.get("detail_description", ""))

            if not description:
                description = await self._text(page, ".JobDescription_container__, .job-description, section")
                description = description[:500] if description else ""

            # 원티드: 주요 업무/자격 요건/우대사항 섹션
            responsibilities_text = await self._text(page, "h4:has-text('주요업무') + div, h4:has-text('주요 업무') + div")
            required_text = await self._text(page, "h4:has-text('자격 요건') + div, h4:has-text('자격요건') + div")
            preferred_text = await self._text(page, "h4:has-text('우대사항') + div")

            responsibilities = [l.strip() for l in responsibilities_text.splitlines() if l.strip()]
            required_skills = [l.strip() for l in required_text.splitlines() if l.strip()]
            preferred_skills = [l.strip() for l in preferred_text.splitlines() if l.strip()]

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
            logger.error("[원티드] 상세 파싱 실패 (%s): %s", url, exc)
            return None
