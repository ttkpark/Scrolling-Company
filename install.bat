@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"

echo.
echo [JobScroll / Scrolling_Company] 설치 스크립트
echo ============================================
echo.

:: Python 확인
where python >nul 2>&1
if %ERRORLEVEL% neq 0 (
  echo [오류] Python이 설치되어 있지 않거나 PATH에 없습니다.
  echo        https://www.python.org/downloads/ 에서 설치 후 PATH에 추가하세요.
  exit /b 1
)
for /f "tokens=*" %%v in ('python -c "import sys; print(sys.version.split()[0])" 2^>nul') do set PY_VER=%%v
echo [OK] Python %PY_VER%

:: 가상환경(.venv) 생성/사용
set "VENV_DIR=%cd%\.venv"
set "VENV_PY=%VENV_DIR%\Scripts\python.exe"

echo.
if not exist "%VENV_PY%" (
  echo [1/4] 가상환경(.venv) 생성 중...
  python -m venv "%VENV_DIR%"
  if %ERRORLEVEL% neq 0 (
    echo [오류] 가상환경 생성 실패 (.venv)
    echo        python3-venv / 가상환경 관련 패키지가 설치되어 있는지 확인하세요.
    exit /b 1
  )
  echo [OK] 가상환경 생성 완료: %VENV_DIR%
) else (
  echo [1/4] 기존 가상환경 사용: %VENV_DIR%
)

:: Python 의존성 (venv)
echo.
echo [2/4] (venv) Python 패키지 설치 (requirements.txt)...
"%VENV_PY%" -m pip install --upgrade pip
"%VENV_PY%" -m pip install -r requirements.txt
if %ERRORLEVEL% neq 0 (
  echo [오류] pip install 실패
  exit /b 1
)
echo [OK] (venv) Python 패키지 설치 완료

:: Playwright 브라우저 (job_explorer 크롤링용, venv)
echo.
echo [3/4] (venv) Playwright 브라우저 설치...
"%VENV_PY%" -m playwright install
if %ERRORLEVEL% neq 0 (
  echo [경고] Playwright 브라우저 설치 실패. job_explorer 크롤링은 동작하지 않을 수 있습니다.
) else (
  echo [OK] Playwright 브라우저 설치 완료
)

:: Node 확인
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
  echo.
  echo [오류] Node.js가 설치되어 있지 않거나 PATH에 없습니다.
  echo        https://nodejs.org/ 에서 LTS 버전을 설치하세요.
  exit /b 1
)
for /f "tokens=*" %%v in ('node -v 2^>nul') do set NODE_VER=%%v
echo.
echo [OK] Node !NODE_VER!

:: npm 의존성
echo.
echo [4/4] Node 패키지 설치 (npm install)...
call npm install
if %ERRORLEVEL% neq 0 (
  echo [오류] npm install 실패
  exit /b 1
)
echo [OK] Node 패키지 설치 완료

:: 데이터/리포트 디렉터리
echo.
echo [4/4] 데이터 디렉터리 확인...
if not exist "data\raw" mkdir "data\raw"
if not exist "data\processed" mkdir "data\processed"
if not exist "reports" mkdir "reports"
echo [OK] data\raw, data\processed, reports 준비됨

echo.
echo ============================================
echo 설치가 완료되었습니다.
echo.
echo 실행 방법:
echo   - venv 활성화:  .venv\Scripts\activate
echo   - 웹 서버:      npm start  (기본 http://localhost:8002)
echo   - 직무 수집:    python -m job_explorer.main
echo   - 수집 옵션:    python -m job_explorer.main --sites hanwha,jobkorea
echo ============================================
echo.
endlocal
exit /b 0
