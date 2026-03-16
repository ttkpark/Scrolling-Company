"""
데이터 정규화 및 중복 제거.
"""
from __future__ import annotations
import re
import logging
from typing import List

from job_explorer.schema.job_role import JobRole

logger = logging.getLogger(__name__)

# 직무명 정규화 매핑 (유사 표현 → 표준 표현)
_NORMALIZE_MAP: dict[str, str] = {
    "ai/ml 엔지니어": "AI/ML 엔지니어",
    "머신러닝 엔지니어": "AI/ML 엔지니어",
    "machine learning engineer": "AI/ML 엔지니어",
    "ml engineer": "AI/ML 엔지니어",
    "데이터 사이언티스트": "데이터 사이언티스트",
    "data scientist": "데이터 사이언티스트",
    "데이터 엔지니어": "데이터 엔지니어",
    "data engineer": "데이터 엔지니어",
    "백엔드 개발": "백엔드 개발자",
    "backend developer": "백엔드 개발자",
    "프론트엔드 개발": "프론트엔드 개발자",
    "frontend developer": "프론트엔드 개발자",
    "풀스택 개발": "풀스택 개발자",
    "서비스 기획": "서비스 기획자",
    "product manager": "PM/프로덕트 매니저",
    "pm": "PM/프로덕트 매니저",
    "ux/ui 디자이너": "UX/UI 디자이너",
    "ui 디자이너": "UX/UI 디자이너",
    "ux 디자이너": "UX/UI 디자이너",
    "인사": "인사(HR)",
    "hr": "인사(HR)",
    "회계": "재무/회계",
    "재무": "재무/회계",
    "마케팅": "마케팅",
    "영업": "영업",
}


def normalize_job_name(name: str) -> str:
    """직무명 소문자 정규화 후 표준명으로 치환."""
    key = re.sub(r"\s+", " ", name.lower().strip())
    return _NORMALIZE_MAP.get(key, name.strip())


def deduplicate(jobs: List[JobRole]) -> List[JobRole]:
    """
    unique_id 기반 중복 제거.
    같은 ID가 여러 건이면 수집 시각이 가장 최신인 것을 유지.
    """
    seen: dict[str, JobRole] = {}
    for job in jobs:
        uid = job.unique_id()
        if uid not in seen or job.collected_at > seen[uid].collected_at:
            seen[uid] = job

    result = list(seen.values())
    removed = len(jobs) - len(result)
    if removed:
        logger.info("중복 %d건 제거 (남은 건수: %d)", removed, len(result))
    return result


def normalize_all(jobs: List[JobRole]) -> List[JobRole]:
    """전체 목록에 직무명 정규화 적용."""
    for job in jobs:
        job.job_name = normalize_job_name(job.job_name)
    return jobs
