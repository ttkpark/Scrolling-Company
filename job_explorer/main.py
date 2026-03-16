"""
직무탐색 자동수집 메인 진입점.

사용:
    python -m job_explorer.main
    python -m job_explorer.main --sites hanwha,jobkorea
    python -m job_explorer.main --sites all --no-headless
"""
from __future__ import annotations
import argparse
import asyncio
import logging
import sys
from typing import List

from job_explorer.config.loader import load_sites_config
from job_explorer.crawler.site_runner import SiteRunner
from job_explorer.parsers.registry import get_parser
from job_explorer.schema.job_role import JobRole
from job_explorer.storage import exporter
from job_explorer.storage.normalizer import normalize_all, deduplicate
from job_explorer.reporting.report_builder import build_report

# ── 로깅 설정 ──────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("data/raw/run.log", encoding="utf-8"),
    ],
)
logger = logging.getLogger("job_explorer.main")


async def run_site(site_cfg: dict, defaults: dict) -> List[JobRole]:
    """단일 사이트 비동기 수집."""
    site_key = site_cfg["key"]
    try:
        parser = get_parser(site_key, site_cfg)
        runner = SiteRunner(site_cfg, defaults)
        return await runner.run(parser)
    except Exception as exc:
        logger.error("[%s] 수집 중 예외 발생: %s", site_key, exc, exc_info=True)
        return []


async def main_async(target_sites: List[str], no_headless: bool) -> None:
    cfg = load_sites_config()
    defaults: dict = cfg.get("defaults", {})

    if no_headless:
        defaults["headless"] = False
        logger.info("헤드리스 모드 OFF: 브라우저 창이 표시됩니다.")

    # 수집 대상 필터링
    sites_list: List[dict] = cfg.get("sites", [])
    if target_sites and target_sites != ["all"]:
        sites_list = [s for s in sites_list if s["key"] in target_sites]
    sites_list = [s for s in sites_list if s.get("enabled", True)]

    if not sites_list:
        logger.error("활성화된 수집 대상이 없습니다. sites.yaml을 확인하세요.")
        return

    logger.info("수집 대상: %s", [s["key"] for s in sites_list])

    # 사이트별 순차 수집 (동시성=1, 서버 부하 최소화)
    all_jobs: List[JobRole] = []
    for site_cfg in sites_list:
        jobs = await run_site(site_cfg, defaults)
        # 사이트별 원본 저장
        exporter.save_raw_json(jobs, site_cfg["key"])
        all_jobs.extend(jobs)

    if not all_jobs:
        logger.warning("수집된 데이터가 없습니다.")
        return

    # 정규화 및 중복 제거
    all_jobs = normalize_all(all_jobs)
    all_jobs = deduplicate(all_jobs)

    # 정제본 저장
    exporter.save_processed_json(all_jobs)
    exporter.save_processed_csv(all_jobs)

    # 리포트 생성
    report_path = build_report(all_jobs)

    logger.info("=" * 60)
    logger.info("수집 완료! 총 %d건", len(all_jobs))
    logger.info("CSV  : data/processed/jobs.csv")
    logger.info("JSON : data/processed/jobs.json")
    logger.info("리포트: %s", report_path)
    logger.info("=" * 60)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="취준 직무탐색 자동수집 도구",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
예시:
  python -m job_explorer.main
  python -m job_explorer.main --sites hanwha,jobkorea
  python -m job_explorer.main --sites all --no-headless
        """,
    )
    parser.add_argument(
        "--sites",
        default="all",
        help="수집 대상 사이트 (쉼표 구분, 예: hanwha,jobkorea / all)",
    )
    parser.add_argument(
        "--no-headless",
        action="store_true",
        help="브라우저 창을 직접 표시 (디버깅용)",
    )

    args = parser.parse_args()
    target_sites = [s.strip() for s in args.sites.split(",") if s.strip()]

    # Windows asyncio 정책 설정
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

    asyncio.run(main_async(target_sites, args.no_headless))


if __name__ == "__main__":
    main()
