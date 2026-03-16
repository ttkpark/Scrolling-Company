# 취준 직무탐색 자동수집 도구

한화인·잡코리아·사람인·원티드의 직무 정보를 자동으로 수집하고
CSV/JSON 데이터셋과 Markdown 리포트를 생성합니다.

---

## 설치

**한 번에 설치** (`.venv` + Python + Playwright + Node 의존성 + 데이터 폴더):

- **Windows**: `install.bat` 더블클릭 또는 `.\install.bat`
- **Linux/macOS**: `chmod +x install.sh && ./install.sh`

(사전 요구: [Python](https://www.python.org/downloads/), [Node.js](https://nodejs.org/) **24.x** 설치 권장)

#### Linux(Ubuntu)에서 Node 24.x 설치 예시

```bash
sudo apt update
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # v24.x.x
npm -v    # 11.x
```

---

### 수동 설치

#### 0. 저장소 불러오기

```powershell
# Linux/macOS
rm -rf Scrolling-Company

# Common
git clone https://github.com/ttkpark/Scrolling-Company
cd Scrolling-Company
git checkout origin/dev
git pull  origin dev
```

#### 1. 가상환경 생성 및 활성화

```powershell
# Windows
python -m venv .venv
.\.venv\Scripts\activate

# Linux/macOS
python3 -m venv .venv
source .venv/bin/activate
```

#### 2. Python 패키지 설치

```powershell
pip install --upgrade pip
pip install -r requirements.txt
```

#### 3. Playwright 브라우저 설치

```powershell
python -m playwright install
```

#### 4. Node 패키지 (웹 서버용)

```powershell
npm install
```

---

## 웹 서버 실행 (포트 8002)

기본 포트는 `8002`입니다.

```powershell
npm start
```

- 접속: `http://localhost:8002`
- 상태 확인: `http://localhost:8002/api/crawl/status`

---

## Linux 부팅 시 자동 실행 (systemd)

리눅스 서버에서 부팅 후 자동으로 웹 서버(8002)를 올리려면:

```bash
chmod +x scripts/setup_venv_linux.sh scripts/start_server_linux.sh scripts/install_systemd_service.sh
./scripts/install_systemd_service.sh ubuntu
```

- `ubuntu` 부분은 실제 실행 계정으로 바꿔주세요.
- 위 스크립트는 `deploy/jobscroll.service`를 기반으로 경로/사용자를 현재 프로젝트에 맞춰 설치합니다.

```bash
sudo systemctl status jobscroll.service
sudo journalctl -u jobscroll.service -f
```

---

## 실행

> 아래 명령은 `venv` 활성화 상태에서 실행하는 것을 권장합니다.

### 전체 사이트 수집

```powershell
python -m job_explorer.main
```

### 특정 사이트만 수집

```powershell
python -m job_explorer.main --sites hanwha,jobkorea
```

사용 가능한 사이트 키: `hanwha`, `jobkorea`, `saramin`, `wanted`

### 브라우저 창 보면서 수집 (디버깅용)

```powershell
python -m job_explorer.main --sites hanwha --no-headless
```

---

## 결과물 위치

| 파일 | 설명 |
| --- | --- |
| `data/raw/{사이트}.json` | 사이트별 원본 수집 데이터 |
| `data/raw/failed_urls.json` | 수집 실패 URL 목록 |
| `data/raw/run.log` | 실행 로그 |
| `data/processed/jobs.csv` | 정제본 CSV (엑셀 가능) |
| `data/processed/jobs.json` | 정제본 JSON |
| `reports/job_exploration_report.md` | Markdown 요약 리포트 |

---

## 프로젝트 구조

```
job_explorer/
├── config/
│   ├── sites.yaml          # 사이트별 설정 (URL, 선택자, 스크롤 방식)
│   └── loader.py
├── crawler/
│   ├── browser_runner.py   # Playwright 브라우저 세션 관리
│   ├── scroll_engine.py    # 자동 스크롤/더보기/페이지네이션
│   ├── site_runner.py      # 사이트 단위 수집 오케스트레이터
│   ├── robots_guard.py     # robots.txt 확인
│   └── fail_logger.py      # 실패 URL 로그
├── parsers/
│   ├── base_parser.py      # 파서 공통 인터페이스
│   ├── hanwha_parser.py
│   ├── jobkorea_parser.py
│   ├── saramin_parser.py
│   ├── wanted_parser.py
│   └── registry.py         # 파서 팩토리
├── schema/
│   └── job_role.py         # 직무 데이터 스키마
├── storage/
│   ├── normalizer.py       # 직무명 정규화 + 중복 제거
│   └── exporter.py         # CSV/JSON 저장
├── reporting/
│   ├── summarizer.py       # 빈도 분석 + 로드맵
│   └── report_builder.py   # Markdown 리포트 생성
└── main.py                 # 실행 진입점
```

---

## 설정 커스터마이징

`job_explorer/config/sites.yaml`을 수정하여:

- 특정 사이트 비활성화: `enabled: false`
- 스크롤 방식 변경: `scroll_type: infinite | load_more | pagination`
- 요청 간격 조정: `request_delay_min`, `request_delay_max`
- 브라우저 표시 여부: `headless: false`

---

## 주의사항

- 각 사이트의 **이용약관 및 robots.txt**를 자동으로 확인합니다.
- 과도한 요청을 방지하기 위해 요청 간 랜덤 대기(1.5~4.0초)가 적용됩니다.
- 수집은 사이트당 최대 50건으로 제한됩니다 (초기 안전 설정).
  변경 시: `site_runner.py`의 `_MAX_DETAILS_PER_SITE` 값 수정.
