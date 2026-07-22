#!/usr/bin/env python3
"""Deploy the API entry point and source modules, then restart PM2."""
import os, sys, time, tarfile, tempfile, paramiko
from pathlib import Path

sys.stdout.reconfigure(errors="replace")

HOST, USER = os.environ.get("LT_DEPLOY_HOST", "159.75.97.172"), os.environ.get("LT_DEPLOY_USER", "ubuntu")
PASSWORD = os.environ.get("SSH_PASS")
ROOT = Path(__file__).resolve().parents[2]
LOCAL = ROOT / "apps" / "api"
REMOTE_TMP = "/tmp/longteng-api.tar.gz"
REMOTE_APP = os.environ.get("LT_REMOTE_API", "/opt/longteng-api")
PM2_NAME = os.environ.get("LT_PM2_NAME", "longteng-api")

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, 22, USER, PASSWORD, timeout=20, look_for_keys=not PASSWORD, allow_agent=not PASSWORD)

def run(command, timeout=60):
    _, stdout, stderr = client.exec_command(command, timeout=timeout)
    out, err = stdout.read().decode(errors="replace"), stderr.read().decode(errors="replace")
    code = stdout.channel.recv_exit_status()
    if out: print(out.rstrip())
    if err: print(err.rstrip())
    if code: raise RuntimeError(f"remote command failed ({code})")

with tempfile.TemporaryDirectory() as temp_dir:
    archive = Path(temp_dir) / "longteng-api.tar.gz"
    with tarfile.open(archive, "w:gz") as tar:
        tar.add(LOCAL / "server.js", arcname="server.js")
        tar.add(LOCAL / "src", arcname="src")

    sftp = client.open_sftp()
    sftp.put(str(archive), REMOTE_TMP)
    sftp.close()

    stamp = time.strftime("%Y%m%d-%H%M%S")
    run(f"sudo -n tar -czf /tmp/longteng-api-backup-{stamp}.tar.gz -C {REMOTE_APP} server.js src 2>/dev/null || sudo -n cp {REMOTE_APP}/server.js /tmp/longteng-api-backup-{stamp}.js")
    run(f"sudo -n cp {REMOTE_APP}/data/longteng.db /tmp/longteng-db-backup-{stamp}.db")
    run(f"sudo -n rm -rf {REMOTE_APP}/src && sudo -n tar -xzf {REMOTE_TMP} -C {REMOTE_APP} && sudo -n chown -R ubuntu:ubuntu {REMOTE_APP}/server.js {REMOTE_APP}/src")
    run(f"cd {REMOTE_APP} && node --check server.js && node --check src/app.js && sudo -n pm2 restart {PM2_NAME}", timeout=60)
    run(f"sleep 2; curl -fsS http://127.0.0.1:3000/api/health; echo; sudo -n pm2 describe {PM2_NAME} | grep -E 'status|uptime' | head -2", timeout=20)

client.close()
print("backend deploy complete")


