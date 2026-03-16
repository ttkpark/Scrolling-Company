"""
CSV / JSON 저장 모듈.
"""
from __future__ import annotations
import csv
import json
import logging
from pathlib import Path
from typing import List

from job_explorer.schema.job_role import JobRole

logger = logging.getLogger(__name__)

_RAW_DIR = Path("data/raw")
_PROCESSED_DIR = Path("data/processed")


def save_raw_json(jobs: List[JobRole], site_key: str) -> Path:
    """원본 수집 데이터를 사이트별 JSON으로 저장."""
    _RAW_DIR.mkdir(parents=True, exist_ok=True)
    path = _RAW_DIR / f"{site_key}.json"
    with open(path, "w", encoding="utf-8") as f:
        json.dump([j.to_dict() for j in jobs], f, ensure_ascii=False, indent=2)
    logger.info("[저장] 원본 JSON: %s (%d건)", path, len(jobs))
    return path


def save_processed_json(jobs: List[JobRole]) -> Path:
    """정제본 전체를 단일 JSON으로 저장."""
    _PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    path = _PROCESSED_DIR / "jobs.json"
    with open(path, "w", encoding="utf-8") as f:
        json.dump([j.to_dict() for j in jobs], f, ensure_ascii=False, indent=2)
    logger.info("[저장] 정제본 JSON: %s (%d건)", path, len(jobs))
    return path


def save_processed_csv(jobs: List[JobRole]) -> Path:
    """정제본 전체를 CSV로 저장."""
    _PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    path = _PROCESSED_DIR / "jobs.csv"

    if not jobs:
        logger.warning("[저장] 저장할 데이터가 없습니다.")
        path.touch()
        return path

    fieldnames = [
        "id", "source", "job_name", "department", "company",
        "description", "responsibilities", "required_skills",
        "preferred_skills", "career_path", "education", "url", "collected_at",
    ]

    with open(path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for job in jobs:
            d = job.to_dict()
            # 리스트 필드를 세미콜론 구분 문자열로 변환
            for list_field in ("responsibilities", "required_skills", "preferred_skills"):
                d[list_field] = "; ".join(d.get(list_field, []))
            writer.writerow({k: d.get(k, "") for k in fieldnames})

    logger.info("[저장] 정제본 CSV: %s (%d건)", path, len(jobs))
    return path
