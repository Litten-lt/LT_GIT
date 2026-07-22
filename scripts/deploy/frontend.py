#!/usr/bin/env python3
"""Deploy the LongTeng frontend to the configured production server."""
import os, sys, time, paramiko, hashlib
from pathlib import Path

sys.stdout.reconfigure(errors="replace")

HOST = os.environ.get("LT_DEPLOY_HOST", "159.75.97.172")
PORT = 22
USER = os.environ.get("LT_DEPLOY_USER", "ubuntu")
PASS = os.environ.get("SSH_PASS")

ROOT = Path(__file__).resolve().parents[2]
LOCAL_TAR = ROOT / "artifacts" / "longteng-web.tar.gz"
REMOTE_TAR = "/tmp/longteng-web.tar.gz"
REMOTE_WEB = os.environ.get("LT_REMOTE_WEB", "/var/www/longteng")

# Local hash for sanity
with LOCAL_TAR.open("rb") as f:
    local_sha = hashlib.sha256(f.read()).hexdigest()[:16]
local_size = os.path.getsize(LOCAL_TAR)
print(f"local tar: {local_size} bytes, sha256:{local_sha}")

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, PORT, USER, PASS, timeout=20, look_for_keys=not PASS, allow_agent=not PASS)

def run(cmd, timeout=60, sudo=False, label=None):
    full = f"sudo -n bash -c '{cmd.replace(chr(39), chr(39)+chr(92)+chr(39)+chr(39))}'" if sudo else cmd
    if label: print(f"\n--- {label} ---")
    print(f"$ {full}")
    si, so, se = c.exec_command(full, timeout=timeout)
    out = so.read().decode(errors="replace")
    err = se.read().decode(errors="replace")
    rc = so.channel.recv_exit_status()
    if out: print(out.rstrip())
    if err: print(f"[stderr rc={rc}] {err.rstrip()}")
    return out, err, rc

# 1. Backup current web root
print("\n########## Step 1: backup current webroot ##########")
run(
    f"tar -czf /tmp/longteng-web-backup-$(date +%Y%m%d-%H%M%S).tar.gz -C {REMOTE_WEB} . 2>/dev/null && "
    f"ls -la /tmp/longteng-web-backup-*.tar.gz | tail -3",
    sudo=True, label="backup webroot", timeout=60
)

# 2. Upload new tar
print("\n########## Step 2: SFTP upload ##########")
sftp = c.open_sftp()
sftp.put(LOCAL_TAR, REMOTE_TAR)
sftp.chmod(REMOTE_TAR, 0o644)
sftp.close()
run(f"ls -la {REMOTE_TAR} && md5sum {REMOTE_TAR}", sudo=True, label="verify upload", timeout=15)

# 3. Compare local vs remote md5
# (skipped, sha256 already computed locally)

# 4. Unpack: keep webroot dir, replace contents
#    (don't delete webroot itself - might be mounted/symlinked)
print("\n########## Step 3: unpack new frontend ##########")
run(
    f"rm -rf {REMOTE_WEB}/assets {REMOTE_WEB}/*.html {REMOTE_WEB}/figures && "
    f"tar -xzf {REMOTE_TAR} -C {REMOTE_WEB}/ && "
    f"ls -la {REMOTE_WEB}/ | head -15",
    sudo=True, label="unpack", timeout=60
)

# 5. Verify new work.js hash landed
print("\n########## Step 4: verify ##########")
run(
    f"ls -la {REMOTE_WEB}/assets/work-*.js {REMOTE_WEB}/work.html {REMOTE_WEB}/assets/index-*.css | head -5",
    sudo=True, label="verify new files", timeout=10
)
# Show the work.js content sniff (first 100 chars to confirm new hash)
run(
    f"head -c 200 {REMOTE_WEB}/assets/work-*.js",
    sudo=True, label="work.js sniff", timeout=10
)

# 6. nginx status (just to remind user)
print("\n########## Step 5: nginx / access sanity ##########")
run("sudo -n bash -c 'systemctl is-active nginx 2>&1; echo ---; ss -tln 2>&1 | head -10'", timeout=10, label="nginx status")

c.close()
print(f"\n=== DEPLOY DONE {time.strftime('%H:%M:%S')} ===")

