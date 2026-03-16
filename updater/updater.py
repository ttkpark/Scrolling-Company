import argparse
import json
import os
import platform
import shlex
import subprocess
import sys
import time
from pathlib import Path


def now() -> str:
    return time.strftime("%Y-%m-%d %H:%M:%S")


def normalize_path(base: Path, value: str) -> Path:
    p = Path(value)
    return p if p.is_absolute() else (base / p).resolve()


class Updater:
    def __init__(self, config_path: Path):
        self.config_path = config_path.resolve()
        with self.config_path.open("r", encoding="utf-8-sig") as f:
            self.cfg = json.load(f)

        cfg_dir = self.config_path.parent
        self.repo_path = normalize_path(cfg_dir, self.cfg.get("repo_path", ".."))
        self.branch = self.cfg.get("branch", "main")
        self.remote = self.cfg.get("remote", "origin")
        self.skip_if_dirty = bool(self.cfg.get("skip_if_dirty", True))
        self.auto_push_local_ahead = bool(self.cfg.get("auto_push_local_ahead", False))

        log_file_raw = self.cfg.get("log_file", "updater/updater.log")
        lock_file_raw = self.cfg.get("lock_file", "updater/updater.lock")
        self.log_file = normalize_path(self.repo_path, log_file_raw)
        self.lock_file = normalize_path(self.repo_path, lock_file_raw)

        self.os_name = "windows" if os.name == "nt" else "linux"

    def log(self, message: str) -> None:
        line = f"[{now()}] {message}"
        print(line)
        self.log_file.parent.mkdir(parents=True, exist_ok=True)
        with self.log_file.open("a", encoding="utf-8") as f:
            f.write(line + "\n")

    def run_git(self, args, check=True) -> str:
        cmd = ["git", "-C", str(self.repo_path), *args]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if check and result.returncode != 0:
            raise RuntimeError(result.stderr.strip() or result.stdout.strip() or "git command failed")
        return (result.stdout or "").strip()

    def run_shell(self, command: str, check=True) -> int:
        if not command:
            return 0
        shell_cmd = ["cmd", "/c", command] if self.os_name == "windows" else ["bash", "-lc", command]
        result = subprocess.run(shell_cmd, cwd=self.repo_path)
        if check and result.returncode != 0:
            raise RuntimeError(f"command failed ({result.returncode}): {command}")
        return result.returncode

    def run_shell_capture(self, command: str) -> str:
        shell_cmd = ["cmd", "/c", command] if self.os_name == "windows" else ["bash", "-lc", command]
        result = subprocess.run(shell_cmd, cwd=self.repo_path, capture_output=True, text=True)
        if result.returncode != 0:
            return ""
        return (result.stdout or "").strip()

    def acquire_lock(self) -> bool:
        self.lock_file.parent.mkdir(parents=True, exist_ok=True)
        try:
            fd = os.open(self.lock_file, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                f.write(str(os.getpid()))
            return True
        except FileExistsError:
            return False

    def release_lock(self) -> None:
        try:
            self.lock_file.unlink(missing_ok=True)
        except Exception:
            pass

    def stop_server(self) -> None:
        stop_cfg = self.cfg.get("stop", {})
        mode = stop_cfg.get("mode", "port")
        if mode != "port":
            self.log("stop mode is not 'port', skip stop")
            return

        port = int(stop_cfg.get("port", 8001))
        pids = []
        if self.os_name == "windows":
            output = self.run_shell_capture(f"netstat -ano -p tcp | findstr :{port}")
            for line in output.splitlines():
                line = line.strip()
                if not line:
                    continue
                parts = line.split()
                if len(parts) >= 5 and parts[-1].isdigit():
                    pids.append(int(parts[-1]))
        else:
            output = self.run_shell_capture(f"lsof -ti tcp:{port}")
            for token in output.split():
                if token.isdigit():
                    pids.append(int(token))
            if not pids:
                output = self.run_shell_capture(f"ss -lptn 'sport = :{port}'")
                for line in output.splitlines():
                    if "pid=" in line:
                        frag = line.split("pid=", 1)[1]
                        pid_str = "".join(ch for ch in frag if ch.isdigit())
                        if pid_str:
                            pids.append(int(pid_str))

        pids = sorted(set(pids))
        if not pids:
            self.log(f"no server process found on port {port}")
            return

        for pid in pids:
            try:
                if self.os_name == "windows":
                    subprocess.run(["taskkill", "/PID", str(pid), "/F"], capture_output=True)
                else:
                    os.kill(pid, 9)
                self.log(f"stopped pid={pid} on port={port}")
            except Exception as e:
                self.log(f"failed to stop pid={pid}: {e}")

    def start_server(self) -> None:
        start_cfg = self.cfg.get("start", {})
        command = start_cfg.get(self.os_name, "")
        if not command:
            self.log("start command missing; skip start")
            return

        if self.os_name == "windows":
            creationflags = subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP
            subprocess.Popen(["cmd", "/c", command], cwd=self.repo_path, creationflags=creationflags)
        else:
            subprocess.Popen(["bash", "-lc", command], cwd=self.repo_path, start_new_session=True)
        self.log("start command executed")

    def maybe_run_setup(self, old_rev: str, new_rev: str) -> None:
        setup_cfg = self.cfg.get("setup", {})
        if not setup_cfg.get("enabled", False):
            self.log("setup disabled")
            return

        watch_files = setup_cfg.get("run_when_changed", [])
        if not watch_files:
            self.log("setup watch list empty, skip")
            return

        changed = self.run_git(["diff", "--name-only", old_rev, new_rev]).splitlines()
        changed_set = {p.strip().replace("\\", "/") for p in changed if p.strip()}
        watch_set = {p.strip().replace("\\", "/") for p in watch_files if p.strip()}

        if changed_set.isdisjoint(watch_set):
            self.log("no watched files changed; skip setup")
            return

        command = setup_cfg.get(self.os_name, "")
        if not command:
            self.log("setup command missing; skip setup")
            return

        self.log("watched files changed; running setup command")
        self.run_shell(command, check=True)

    def ensure_branch(self) -> None:
        current = self.run_git(["rev-parse", "--abbrev-ref", "HEAD"])
        if current != self.branch:
            self.log(f"switch branch {current} -> {self.branch}")
            self.run_git(["checkout", self.branch], check=True)

    def update_once(self) -> int:
        if not self.acquire_lock():
            self.log("another updater process is already running; skip")
            return 0

        try:
            self.log(f"updater start ({platform.system()})")

            if self.skip_if_dirty:
                dirty = self.run_git(["status", "--porcelain"], check=True)
                if dirty:
                    self.log("working tree is dirty; skip update")
                    return 0

            self.ensure_branch()
            self.run_git(["fetch", self.remote, self.branch], check=True)

            local = self.run_git(["rev-parse", "HEAD"], check=True)
            remote = self.run_git(["rev-parse", f"{self.remote}/{self.branch}"], check=True)
            base = self.run_git(["merge-base", "HEAD", f"{self.remote}/{self.branch}"], check=True)

            if local == remote:
                self.log("already up to date")
                return 0

            if local == base:
                self.log("remote has new commits; updating")
                self.stop_server()
                old = local
                self.run_git(["pull", "--ff-only", self.remote, self.branch], check=True)
                new = self.run_git(["rev-parse", "HEAD"], check=True)
                self.maybe_run_setup(old, new)
                self.start_server()
                self.log("update completed")
                return 0

            if remote == base:
                if self.auto_push_local_ahead:
                    self.log("local branch ahead; pushing to remote")
                    self.run_git(["push", self.remote, self.branch], check=True)
                    self.log("push completed")
                else:
                    self.log("local branch ahead; auto push disabled")
                return 0

            self.log("branch diverged; manual action required")
            return 1
        except Exception as e:
            self.log(f"error: {e}")
            return 1
        finally:
            self.release_lock()


def parse_args():
    parser = argparse.ArgumentParser(description="Reusable git updater for deployment branch")
    parser.add_argument("--config", default="project.json", help="config file path (default: project.json)")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    config_path = Path(args.config)
    if not config_path.is_absolute():
        from_cwd = config_path.resolve()
        if from_cwd.exists():
            config_path = from_cwd
        else:
            config_path = (Path(__file__).resolve().parent / config_path).resolve()
    updater = Updater(config_path)
    return updater.update_once()


if __name__ == "__main__":
    raise SystemExit(main())

