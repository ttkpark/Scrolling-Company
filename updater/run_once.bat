@echo off
setlocal
cd /d "%~dp0"
python updater.py --config project.json
endlocal
