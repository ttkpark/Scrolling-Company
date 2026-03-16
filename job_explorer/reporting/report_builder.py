"""
Markdown 요약 리포트 생성기.
"""
from __future__ import annotations
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import List

from job_explorer.schema.job_role import JobRole
from job_explorer.reporting import summarizer as sm

logger = logging.getLogger(__name__)

_REPORTS_DIR = Path("reports")


def build_report(jobs: List[JobRole]) -> Path:
    """수집 데이터 기반 Markdown 리포트 생성 후 저장 경로 반환."""
    _REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    path = _REPORTS_DIR / "job_exploration_report.md"

    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    total = len(jobs)

    # 통계 계산
    by_source = sm.jobs_by_source(jobs)
    top_jobs = sm.top_job_names(jobs, top_n=10)
    top_skills = sm.top_skills(jobs, top_n=15)
    top_depts = sm.jobs_by_department(jobs, top_n=10)
    roadmap = sm.generate_roadmap(top_jobs)

    lines: List[str] = [
        "# 취준 직무탐색 자동수집 리포트",
        "",
        f"생성일시: {now}  ",
        f"총 수집 건수: **{total}건**",
        "",
        "---",
        "",
        "## 1. 사이트별 수집 현황",
        "",
        "| 사이트 | 수집 건수 |",
        "| --- | --- |",
    ]
    for source, count in sorted(by_source.items(), key=lambda x: -x[1]):
        lines.append(f"| {source} | {count}건 |")

    lines += [
        "",
        "---",
        "",
        "## 2. 상위 직무명 (빈도 순)",
        "",
        "| 순위 | 직무명 | 건수 |",
        "| --- | --- | --- |",
    ]
    for rank, (name, cnt) in enumerate(top_jobs, 1):
        lines.append(f"| {rank} | {name} | {cnt} |")

    lines += [
        "",
        "---",
        "",
        "## 3. 자주 등장한 역량/기술 키워드",
        "",
        "| 키워드 | 등장 횟수 |",
        "| --- | --- |",
    ]
    for skill, cnt in top_skills:
        lines.append(f"| {skill} | {cnt} |")

    if top_depts:
        lines += [
            "",
            "---",
            "",
            "## 4. 직군/부서별 현황",
            "",
            "| 직군 | 건수 |",
            "| --- | --- |",
        ]
        for dept, cnt in top_depts:
            lines.append(f"| {dept} | {cnt} |")

    lines += [
        "",
        "---",
        "",
        "## 5. 초보자용 우선순위 학습 로드맵 (4주)",
        "",
        f"> 상위 직무 **{top_jobs[0][0] if top_jobs else ''}** 기준",
        "",
    ]
    for step in roadmap:
        lines.append(f"- {step}")

    lines += [
        "",
        "---",
        "",
        "## 6. 데이터 파일 위치",
        "",
        "- 원본: `data/raw/*.json`",
        "- 정제본: `data/processed/jobs.csv`, `data/processed/jobs.json`",
        "",
        "> 이 리포트는 자동 생성되었습니다. `python -m job_explorer.main` 재실행 시 갱신됩니다.",
    ]

    content = "\n".join(lines)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

    logger.info("[리포트] 저장 완료: %s", path)
    return path
