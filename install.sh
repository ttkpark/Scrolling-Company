#!/usr/bin/env bash
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo "[JobScroll / Scrolling_Company] 설치 스크립트"
echo "============================================"
echo ""

# Python 확인 (python3 우선)
if command -v python3 &>/dev/null; then
  PYTHON=python3
  PIP="python3 -m pip"
elif command -v python &>/dev/null; then
  PYTHON=python
  PIP="python -m pip"
else
  echo "[오류] Python이 설치되어 있지 않습니다."
  echo "       (Ubuntu/Debian: sudo apt install python3 python3-pip)"
  exit 1
fi
echo "[OK] $($PYTHON --version 2>&1)"

# Python 의존성
echo ""
echo "[1/4] Python 패키지 설치 (requirements.txt)..."
$PIP install -r requirements.txt
echo "[OK] Python 패키지 설치 완료"

# Playwright 브라우저 (job_explorer 크롤링용)
echo ""
echo "[2/4] Playwright 브라우저 설치..."
if $PYTHON -m playwright install 2>/dev/null; then
  echo "[OK] Playwright 브라우저 설치 완료"
else
  echo "[경고] Playwright 브라우저 설치 실패. job_explorer 크롤링은 동작하지 않을 수 있습니다."
fi

# Node 확인
if ! command -v node &>/dev/null; then
  echo ""
  echo "[오류] Node.js가 설치되어 있지 않습니다."
  echo "       (Ubuntu/Debian: curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - && sudo apt install -y nodejs)"
  exit 1
fi
echo ""
echo "[OK] Node $(node -v)"

# npm 의존성
echo ""
echo "[3/4] Node 패키지 설치 (npm install)..."
npm install
echo "[OK] Node 패키지 설치 완료"

# 데이터/리포트 디렉터리
echo ""
echo "[4/4] 데이터 디렉터리 확인..."
mkdir -p data/raw data/processed reports
echo "[OK] data/raw, data/processed, reports 준비됨"

echo ""
echo "============================================"
echo "설치가 완료되었습니다."
echo ""
echo "실행 방법:"
echo "  - 웹 서버:    npm start  (기본 http://localhost:3000)"
echo "  - 직무 수집:  $PYTHON -m job_explorer.main"
echo "  - 수집 옵션:  $PYTHON -m job_explorer.main --sites hanwha,jobkorea"
echo "============================================"
echo ""
