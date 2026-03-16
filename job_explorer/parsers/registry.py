"""파서 팩토리: site_key → 파서 인스턴스 반환."""
from __future__ import annotations
from job_explorer.parsers.base_parser import BaseParser
from job_explorer.parsers.hanwha_parser import HanwhaParser
from job_explorer.parsers.jobkorea_parser import JobkoreaParser
from job_explorer.parsers.saramin_parser import SaraminParser
from job_explorer.parsers.wanted_parser import WantedParser

_REGISTRY: dict[str, type[BaseParser]] = {
    "hanwha": HanwhaParser,
    "jobkorea": JobkoreaParser,
    "saramin": SaraminParser,
    "wanted": WantedParser,
}


def get_parser(site_key: str, config: dict) -> BaseParser:
    cls = _REGISTRY.get(site_key)
    if cls is None:
        raise ValueError(f"등록되지 않은 사이트 키: {site_key}")
    return cls(config)
