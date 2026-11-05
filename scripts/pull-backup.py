"""Download one fixed backup through a server-side restricted SSH key."""
import os,json,sys,tarfile,datetime
from pathlib import Path
import paramiko
config=json.loads(Path(sys.argv[1]).read_text(encoding='utf-8-sig'))
destination=Path(config['Destination']);destination.mkdir(parents=True,exist_ok=True)
day=datetime.date.today().isoformat();target=destination/f'daily-{day}.tar.gz';partial=target.with_suffix('.gz.partial')
client=paramiko.SSHClient();client.load_host_keys(config['KnownHosts'])
try:
    key=paramiko.Ed25519Key.from_private_key_file(config['KeyPath'],password=os.environ.pop('ZHIMU_BACKUP_KEY_PASSWORD'))
    client.connect(config['Host'],username=config['User'],pkey=key,look_for_keys=False,allow_agent=False,timeout=20)
    _,out,err=client.exec_command('download-latest',timeout=120)
    with partial.open('wb') as stream:
        while chunk:=out.read(65536):stream.write(chunk)
    if out.channel.recv_exit_status()!=0:raise RuntimeError('Backup download failed')
    with tarfile.open(partial,'r:gz') as tar:
        names={m.name.lstrip('./') for m in tar.getmembers()}
        if not {'zhimu.db','manifest.json'}.issubset(names):raise RuntimeError('Invalid backup contents')
        for member in tar.getmembers():
            if member.isfile():
                content=tar.extractfile(member)
                while content.read(65536):pass
    partial.replace(target)
    if datetime.date.today().weekday()==6:(destination/f'weekly-{day}.tar.gz').write_bytes(target.read_bytes())
    for prefix,keep in [('daily-',7),('weekly-',4)]:
        for item in sorted(destination.glob(prefix+'????-??-??.tar.gz'),reverse=True)[keep:]:item.unlink()
    (destination/'status.json').write_text(json.dumps({'last_success':datetime.datetime.now().astimezone().isoformat(),'archive':str(target),'archive_verified':True},indent=2),encoding='utf8')
    print('Off-server backup downloaded and verified')
except Exception as error:
    (destination/'last-error.txt').write_text(str(error),encoding='utf8')
    raise
finally:
    client.close();partial.unlink(missing_ok=True)
