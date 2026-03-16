"""
수집 데이터 통계 요약 분석기.
외부 API 없이 단순 빈도 분석 기반으로 인사이트를 추출합니다.
"""
from __future__ import annotations
import re
from collections import Counter
from typing import List

from job_explorer.schema.job_role import JobRole


def _tokenize(text: str) -> List[str]:
    """텍스트에서 의미 있는 단어 토큰 추출 (2글자 이상)."""
    return [w for w in re.findall(r"[가-힣A-Za-z0-9/+#.]+", text) if len(w) >= 2]


def top_job_names(jobs: List[JobRole], top_n: int = 10) -> List[tuple[str, int]]:
    """직무명 빈도 상위 N개."""
    counter: Counter = Counter(j.job_name for j in jobs if j.job_name)
    return counter.most_common(top_n)


def top_skills(jobs: List[JobRole], top_n: int = 15) -> List[tuple[str, int]]:
    """필수 역량(required_skills) + 우대사항(preferred_skills) 합산 빈도."""
    counter: Counter = Counter()
    for job in jobs:
        for skill in job.required_skills + job.preferred_skills:
            tokens = _tokenize(skill)
            counter.update(tokens)

    # 불용어 제거
    STOPWORDS = {
        "및", "또는", "등", "수", "이상", "경험", "능력", "역량", "보유",
        "가능", "활용", "관련", "분야", "기반", "이해", "사용", "업무", "기술",
        "the", "and", "or", "of", "in", "to", "a", "an", "for", "with",
    }
    for sw in STOPWORDS:
        counter.pop(sw, None)

    return counter.most_common(top_n)


def jobs_by_source(jobs: List[JobRole]) -> dict[str, int]:
    """사이트별 수집 건수."""
    counter: Counter = Counter(j.source for j in jobs)
    return dict(counter)


def jobs_by_department(jobs: List[JobRole], top_n: int = 10) -> List[tuple[str, int]]:
    """직군/부서별 수집 건수 상위."""
    counter: Counter = Counter(j.department for j in jobs if j.department)
    return counter.most_common(top_n)


# 초보자 우선순위 학습 로드맵 (직무명 기반 키워드 매핑)
_ROADMAP: dict[str, List[str]] = {
    "AI/ML 엔지니어": [
        "1주차: Python 기초 + NumPy/Pandas",
        "2주차: 머신러닝 개념 (scikit-learn)",
        "3주차: 딥러닝 기초 (TensorFlow/PyTorch)",
        "4주차: 포트폴리오 프로젝트 구성",
    ],
    "데이터 엔지니어": [
        "1주차: SQL + Python 기초",
        "2주차: Spark/Hadoop 입문",
        "3주차: ETL 파이프라인 설계",
        "4주차: 클라우드(AWS/GCP) 기초",
    ],
    "데이터 사이언티스트": [
        "1주차: 통계/확률 기초",
        "2주차: Python + Pandas 데이터 분석",
        "3주차: 시각화(Matplotlib, Tableau)",
        "4주차: 모델 개발 및 발표 연습",
    ],
    "백엔드 개발자": [
        "1주차: Python/Java 기초",
        "2주차: REST API 설계",
        "3주차: DB(MySQL/PostgreSQL) 실습",
        "4주차: Docker + 배포 경험",
    ],
    "프론트엔드 개발자": [
        "1주차: HTML/CSS 기초",
        "2주차: JavaScript ES6+",
        "3주차: React/Vue 입문",
        "4주차: 반응형 UI 포트폴리오",
    ],
    "PM/프로덕트 매니저": [
        "1주차: 서비스 기획 개념 (Figma)",
        "2주차: 사용자 리서치 방법론",
        "3주차: 데이터 분석 기초 (GA, SQL)",
        "4주차: 요구사항 정의서 작성 실습",
    ],
}
_DEFAULT_ROADMAP = [
    "1주차: 목표 직무 1~2개 확정 및 JD 분석",
    "2주차: 해당 직무 핵심 기술 기초 학습",
    "3주차: 관련 프로젝트 1건 착수",
    "4주차: 이력서 + 자소서 초안 작성",
]


def generate_roadmap(top_jobs: List[tuple[str, int]]) -> List[str]:
    """상위 직무를 기반으로 초보자 학습 로드맵 반환."""
    if not top_jobs:
        return _DEFAULT_ROADMAP

    top_name = top_jobs[0][0]
    for key, roadmap in _ROADMAP.items():
        if key in top_name or top_name in key:
            return roadmap
    return _DEFAULT_ROADMAP
