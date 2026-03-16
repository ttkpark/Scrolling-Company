# Reusable Updater Module

Copy this `updater` folder into any git project and edit only `project.json`.
Then run `run_once.bat` (Windows) or `run_once.sh` (Linux).

## 이 프로젝트(Scrolling_Company / JobScroll)에서

- **서버**: `npm start` → Express 서버, 기본 포트 **3000**
- **업데이트 시**: 3000 포트 프로세스 종료 → `git pull --ff-only` → 필요 시 setup 실행 → `npm start` 재실행
- **setup**: `requirements.txt` 또는 `package.json`/`package-lock.json` 변경 시에만 실행  
  (Python: `pip install -r requirements.txt`, Node: `npm install`)

## What it does

- Fetches `<remote>/<branch>`.
- If remote has newer commits:
  - Stops server process by configured port.
  - Pulls with `--ff-only`.
  - Runs setup command only when watched files changed.
  - Starts server command.
- If local branch is ahead:
  - Optional auto push (`auto_push_local_ahead`).
- If branch diverged:
  - Logs and exits (manual action).

## Required files

- `updater.py`
- `project.json`
- `run_once.bat` / `run_once.sh`

## project.json fields

- `repo_path`: git repo root path (relative or absolute)
- `branch`: deployment branch name
- `remote`: usually `origin`
- `log_file`: updater log path
- `lock_file`: lock file path
- `skip_if_dirty`: skip auto-update when working tree has changes
- `auto_push_local_ahead`: auto push when local branch ahead
- `stop.mode`: only `port` is currently supported
- `stop.port`: port number to stop before update
- `start.windows` / `start.linux`: command to start server
- `setup.enabled`: whether setup step can run
- `setup.windows` / `setup.linux`: setup command
- `setup.run_when_changed`: file list to trigger setup

## Schedule (Windows)

Run every 5 minutes using Task Scheduler:

```powershell
$repo = "C:\path\to\repo"
$script = "$repo\updater\run_once.bat"
$taskName = "Project-AutoUpdater"

$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$script`""
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1)
$trigger.RepetitionInterval = (New-TimeSpan -Minutes 5)
$trigger.RepetitionDuration = ([TimeSpan]::MaxValue)
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -RunLevel Highest -Force
```

## Schedule (Linux)

```bash
chmod +x updater/run_once.sh
(crontab -l 2>/dev/null; echo "*/5 * * * * /bin/bash /path/to/repo/updater/run_once.sh") | crontab -
```
