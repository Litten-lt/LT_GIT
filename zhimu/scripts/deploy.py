"""Deploy Zhimu with its own Nginx virtual host and independent health checks."""
import os
import shlex
import sys
import tarfile
import tempfile
import time
from pathlib import Path
import paramiko

sys.stdout.reconfigure(errors='replace')
ROOT = Path(__file__).resolve().parents[1]
HOST = os.environ.get('LT_DEPLOY_HOST', '159.75.97.172')
USER = os.environ.get('LT_DEPLOY_USER', 'ubuntu')
STAMP = time.strftime('%Y%m%d-%H%M%S')
RELEASE = f'/opt/zhimu/releases/{STAMP}'
CONFIG = '/etc/nginx/sites-available/zhimu'
client = paramiko.SSHClient()
client.load_system_host_keys()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
password = os.environ.get('SSH_PASS')
client.connect(HOST, username=USER, password=password, look_for_keys=not password, allow_agent=not password, timeout=20)

def run(command, timeout=60):
    _, out, err = client.exec_command(command, timeout=timeout)
    stdout, stderr = out.read().decode(errors='replace'), err.read().decode(errors='replace')
    code = out.channel.recv_exit_status()
    if stdout: print(stdout.rstrip(), flush=True)
    if stderr: print(stderr.rstrip(), flush=True)
    if code: raise RuntimeError(f'remote step failed ({code})')
    return stdout

try:
    # Code goes into a new release. No runtime data is uploaded or overwritten.
    run(f'sudo -n install -d -o {shlex.quote(USER)} -g {shlex.quote(USER)} {RELEASE} /opt/zhimu-data /var/backups/zhimu')
    previous = run('readlink /opt/zhimu/current || true').strip()
    if previous:
        run(f'cd /opt/zhimu/current && DATA_DIR=/opt/zhimu-data node scripts/backup.mjs /var/backups/zhimu/predeploy-{STAMP}.db')
    with tempfile.TemporaryDirectory() as folder:
        archive = Path(folder)/'zhimu.tar.gz'
        with tarfile.open(archive, 'w:gz') as tar:
            for name in ['server.js','src','public','tests','scripts','deploy','package.json','package-lock.json','README.md']:
                tar.add(ROOT/name, arcname=name)
        sftp = client.open_sftp()
        remote_archive = f'/tmp/zhimu-{STAMP}.tar.gz'
        sftp.put(str(archive), remote_archive)
        sftp.close()
    run(f'tar -xzf {remote_archive} -C {RELEASE}')
    run(f'cd {RELEASE} && npm ci --omit=dev --no-audit --no-fund', 240)
    run(f'cd {RELEASE} && node --check src/app.js && node --check public/app.js && node --test tests/*.test.mjs', 60)
    run(f'sudo -n ln -sfn {RELEASE} /opt/zhimu/current')
    env='NODE_ENV=production PORT=3210 BASE_PATH=/zhimu DATA_DIR=/opt/zhimu-data'
    run(f'if sudo -n pm2 describe zhimu >/dev/null 2>&1; then sudo -n env {env} pm2 restart zhimu --update-env; else sudo -n env {env} pm2 start /opt/zhimu/current/server.js --name zhimu --cwd /opt/zhimu/current; fi')
    run("for n in 1 2 3 4 5; do curl -fsS http://127.0.0.1:3210/zhimu/api/health && break; sleep 1; done; curl -fsS http://127.0.0.1:3210/zhimu/api/health")
    # Snapshot Nginx before replacing the virtual host. No dependency on a legacy app.
    snapshot=f'/var/backups/zhimu/nginx-independent-{STAMP}.tar.gz'
    run(f'sudo -n tar -czf {snapshot} -C /etc/nginx sites-available sites-enabled snippets && sudo -n chmod 600 {snapshot}')
    run(f'sudo -n install -m 644 {RELEASE}/deploy/nginx.conf {CONFIG} && sudo -n install -m 644 {RELEASE}/deploy/site.conf /etc/nginx/snippets/zhimu-site.conf && sudo -n install -d /var/www/zhimu-acme')
    run("sudo -n ln -sfn /etc/nginx/sites-available/zhimu /etc/nginx/sites-enabled/zhimu")
    try:
        run('sudo -n nginx -t && sudo -n systemctl reload nginx')
        run("curl -fsS http://127.0.0.1:3210/zhimu/api/health && curl -fsS http://127.0.0.1/zhimu/api/health && curl -fsSL http://127.0.0.1/ | head -c 200")
        run("test $(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1/api/health) = 404")
    except Exception:
        run(f'sudo -n unlink /etc/nginx/sites-enabled/zhimu && sudo -n tar -xzf {snapshot} -C /etc/nginx && sudo -n nginx -t && sudo -n systemctl reload nginx')
        if previous: run(f'sudo -n ln -sfn {shlex.quote(previous)} /opt/zhimu/current && sudo -n pm2 restart zhimu')
        raise
    run('sudo -n pm2 save')
    print(f'ZHIMU_DEPLOYED http://{HOST}/zhimu/ (verify domain TLS separately)',flush=True)
finally:
    client.close()
