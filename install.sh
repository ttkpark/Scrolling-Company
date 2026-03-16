#!/usr/bin/env bash
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo "[JobScroll / Scrolling_Company] 설치 스크립트"
echo "============================================"
echo ""

# Python 확인 (python3 우선, venv용 베이스 파이썬)
if command -v python3 &>/dev/null; then
  BASE_PYTHON=python3
elif command -v python &>/dev/null; then
  BASE_PYTHON=python
else
  echo "[오류] Python이 설치되어 있지 않습니다."
  echo "       (Ubuntu/Debian: sudo apt install python3 python3-venv python3-pip)"
  exit 1
fi
echo "[OK] $($BASE_PYTHON --version 2>&1)"

# 가상환경(.venv) 생성/사용
VENV_DIR="$SCRIPT_DIR/.venv"
VENV_PY="$VENV_DIR/bin/python"

echo ""
if [ ! -x "$VENV_PY" ]; then
  echo "[1/4] 가상환경(.venv) 생성 중..."
  $BASE_PYTHON -m venv "$VENV_DIR"
  echo "[OK] 가상환경 생성 완료: $VENV_DIR"
else
  echo "[1/4] 기존 가상환경 사용: $VENV_DIR"
fi

echo ""
echo "[2/4] (venv) Python 패키지 설치 (requirements.txt)..."
"$VENV_PY" -m pip install --upgrade pip
"$VENV_PY" -m pip install -r requirements.txt
echo "[OK] (venv) Python 패키지 설치 완료"

# Playwright 브라우저 (job_explorer 크롤링용) - venv 기준
echo ""
echo "[3/4] (venv) Playwright 브라우저 설치..."
if "$VENV_PY" -m playwright install 2>/dev/null; then
  echo "[OK] Playwright 브라우저 설치 완료"
else
  echo "[경고] Playwright 브라우저 설치 실패. job_explorer 크롤링은 동작하지 않을 수 있습니다."
fi

# Node 확인 (Node 24.x 권장)
if ! command -v node &>/dev/null; then
  echo ""
  echo "[오류] Node.js가 설치되어 있지 않습니다."
  echo "       (Ubuntu/Debian, Node 24.x 예시):"
  echo "         curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -"
  echo "         sudo apt install -y nodejs"
  exit 1
fi
echo ""
echo "[OK] Node $(node -v)"

# npm 의존성
echo ""
echo "[4/4] Node 패키지 설치 (npm install)..."
npm install
echo "[OK] Node 패키지 설치 완료"

# 데이터/리포트 디렉터리
echo ""
echo "[추가] 데이터 디렉터리 확인..."
mkdir -p data/raw data/processed reports
echo "[OK] data/raw, data/processed, reports 준비됨"

echo ""
echo "============================================"
echo "설치가 완료되었습니다."
echo ""
echo "실행 방법:"
echo "  - venv 활성화:  source .venv/bin/activate"
echo "  - 웹 서버:      npm start  (기본 http://localhost:8002)"
echo "  - 직무 수집:    python -m job_explorer.main"
echo "  - 수집 옵션:    python -m job_explorer.main --sites hanwha,jobkorea"
echo "============================================"
echo ""
