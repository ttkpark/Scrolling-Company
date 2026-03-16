"""
직무 데이터 공통 스키마 정의
"""
from __future__ import annotations
from dataclasses import dataclass, field, asdict
from typing import Optional
import hashlib


@dataclass
class JobRole:
    """수집된 단일 직무 항목."""
    source: str                     # 수집 출처 사이트 (예: hanwha, jobkorea)
    job_name: str                   # 직무명 (예: 데이터 엔지니어)
    department: str = ""            # 부서/직군 (예: IT, 경영지원)
    company: str = ""               # 회사명 (예: 한화시스템)
    description: str = ""           # 직무 설명
    responsibilities: list[str] = field(default_factory=list)   # 주요 업무
    required_skills: list[str] = field(default_factory=list)    # 필수 역량/기술
    preferred_skills: list[str] = field(default_factory=list)   # 우대 사항
    career_path: str = ""           # 경력 경로
    education: str = ""             # 학력/전공 요건
    url: str = ""                   # 원본 페이지 URL
    collected_at: str = ""          # 수집 일시 (ISO 8601)

    def unique_id(self) -> str:
        """소스+직무명 기반 고유 해시 ID."""
        key = f"{self.source}|{self.job_name}|{self.company}".lower().strip()
        return hashlib.md5(key.encode("utf-8")).hexdigest()[:12]

    def to_dict(self) -> dict:
        d = asdict(self)
        d["id"] = self.unique_id()
        return d
