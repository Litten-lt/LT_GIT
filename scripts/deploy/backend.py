#!/usr/bin/env python3
"""Atomically deploy chesshub-server/server.js and restart the existing PM2 process."""
import os, time, paramiko
from pathlib import Path

HOST, USER = "159.75.97.172", "ubuntu"
PASSWORD = os.environ["SSH_PASS"]
ROOT = Path(__file__).resolve().parents[2]
LOCAL = ROOT / "apps" / "api" / "server.js"
REMOTE_TMP = "/tmp/chesshub-server.js.new"
REMOTE_APP = "/opt/chesshub-server"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, 22, USER, PASSWORD, timeout=20, look_for_keys=False, allow_agent=False)

def run(command, timeout=60):
    _, stdout, stderr = client.exec_command(command, timeout=timeout)
    out, err = stdout.read().decode(errors="replace"), stderr.read().decode(errors="replace")
    code = stdout.channel.recv_exit_status()
    if out: print(out.rstrip())
    if err: print(err.rstrip())
    if code: raise RuntimeError(f"remote command failed ({code})")

sftp = client.open_sftp(); sftp.put(LOCAL, REMOTE_TMP); sftp.close()
stamp = time.strftime("%Y%m%d-%H%M%S")
run(f"sudo -n cp {REMOTE_APP}/server.js /tmp/chesshub-server-backup-{stamp}.js")
run(f"sudo -n cp {REMOTE_APP}/data/chesshub.db /tmp/chesshub-db-backup-{stamp}.db")
run(f"sudo -n install -o ubuntu -g ubuntu -m 0644 {REMOTE_TMP} {REMOTE_APP}/server.js")
run(f"cd {REMOTE_APP} && node --check server.js && sudo -n pm2 restart chesshub-server", timeout=60)
run("sleep 2; curl -fsS http://127.0.0.1:3000/api/health; echo; sudo -n pm2 describe chesshub-server | grep -E 'status|uptime' | head -2", timeout=20)
client.close()
print("backend deploy complete")


