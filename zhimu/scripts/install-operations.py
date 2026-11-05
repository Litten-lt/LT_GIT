import os,sys,json,shlex,secrets
from pathlib import Path
import paramiko
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives import serialization
sys.stdout.reconfigure(errors='replace')
root=Path(__file__).resolve().parents[2];private=root/'artifacts/zhimu-operations';private.mkdir(exist_ok=True)
c=paramiko.SSHClient();c.load_system_host_keys();c.set_missing_host_key_policy(paramiko.AutoAddPolicy());p=os.environ.get('SSH_PASS');user=os.environ.get('LT_DEPLOY_USER','ubuntu');host='159.75.97.172'
c.connect(host,username=user,password=p,look_for_keys=not p,allow_agent=not p,timeout=20)
def run(command):
 _,out,err=c.exec_command(command,timeout=120);result=out.read().decode();error=err.read().decode()
 if out.channel.recv_exit_status():raise RuntimeError(error or result)
 if result:print(result.rstrip())
 return result
try:
 s=c.open_sftp()
 # This credential cannot run arbitrary commands or forward ports; only the fixed archive is readable.
 keyfile=private/'backup-key.pem'
 if not keyfile.exists():
  key=Ed25519PrivateKey.generate();phrase=secrets.token_urlsafe(32)
  keyfile.write_bytes(key.private_bytes(serialization.Encoding.PEM,serialization.PrivateFormat.OpenSSH,serialization.BestAvailableEncryption(phrase.encode())))
  (private/'key-password.tmp').write_text(phrase,encoding='utf8')
  pub=key.public_key().public_bytes(serialization.Encoding.OpenSSH,serialization.PublicFormat.OpenSSH).decode()
  (private/'backup-key.pub').write_text(pub,encoding='utf8')
 pub=(private/'backup-key.pub').read_text(encoding='utf8')
 known=private/'known_hosts';known.write_text(host+' '+c.get_transport().get_remote_server_key().get_name()+' '+c.get_transport().get_remote_server_key().get_base64()+'\n',encoding='utf8')
 export=f'/home/{user}/.zhimu-backup/latest.tar.gz'
 run(f'install -d -m 700 /home/{user}/.zhimu-backup /home/{user}/.ssh')
 forced='restrict,command="cat '+export+'" '+pub+' zhimu-readonly-backup'
 auth=f'/home/{user}/.ssh/authorized_keys'
 try:
  with s.open(auth,'r') as f:existing=f.read().decode()
 except IOError:existing=''
 if pub not in existing:
  with s.open(auth,'a') as f:f.write('\n'+forced+'\n')
  s.chmod(auth,0o600)
 service=f'''[Unit]
Description=Zhimu verified database and image backup
[Service]
Type=oneshot
UMask=0077
Environment=DATA_DIR=/opt/zhimu-data
Environment=BACKUP_DIR=/var/backups/zhimu/automatic
Environment=OFFSITE_FILE={export}
WorkingDirectory=/opt/zhimu/current
ExecStart=/usr/bin/flock -n /var/lock/zhimu-backup.lock /usr/bin/node /opt/zhimu/current/scripts/automatic-backup.mjs
ExecStartPost=/usr/bin/chown {user}:{user} {export}
ExecStartPost=/usr/bin/chmod 600 {export}
'''
 timer='''[Unit]
Description=Daily Zhimu backup at 03:10 Shanghai time
[Timer]
OnCalendar=*-*-* 03:10:00 Asia/Shanghai
Persistent=true
RandomizedDelaySec=120
[Install]
WantedBy=timers.target
'''
 for name,body in [('zhimu-backup.service',service),('zhimu-backup.timer',timer)]:
  with s.open('/tmp/'+name,'w') as f:f.write(body)
  run('sudo -n install -m 644 /tmp/'+name+' /etc/systemd/system/'+name)
 run('sudo -n systemctl daemon-reload && sudo -n systemctl enable --now zhimu-backup.timer && sudo -n systemctl start zhimu-backup.service')
 run('sudo -n cat /var/backups/zhimu/automatic/status.json; systemctl list-timers zhimu-backup.timer --no-pager')
 run('cd /opt/zhimu/current && if ! sudo -n test -f /var/backups/zhimu/initial-admin.json; then sudo -n env DATA_DIR=/opt/zhimu-data node scripts/provision-admin.mjs /var/backups/zhimu/initial-admin.json; fi')
 # Download over the authenticated SSH channel without printing secrets.
 run('sudo -n install -m 600 -o '+user+' /var/backups/zhimu/initial-admin.json /tmp/zhimu-initial-admin-transfer.json')
 s.get('/tmp/zhimu-initial-admin-transfer.json',str(private/'admin-credentials.json'));s.remove('/tmp/zhimu-initial-admin-transfer.json')
 run('sudo -n rm -- /var/backups/zhimu/initial-admin.json')
 config={'Host':host,'User':user,'KeyPath':str(keyfile),'KnownHosts':str(known),'SecretPath':str(private/'key-password.dpapi'),'Destination':str(root/'artifacts/zhimu-offsite-backups'),'Python':sys.executable}
 (private/'backup-config.json').write_text(json.dumps(config,indent=2),encoding='utf8')
 s.close()
finally:c.close()
