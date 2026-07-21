# 部署与服务器迁移手册

本文适用于当前项目结构：React/Vite 前端、Node.js/Express 后端、SQLite 数据库、Nginx 静态托管与反向代理、PM2 进程管理。示例系统为 Ubuntu Server 24.04 LTS。

> 所有命令中的域名、IP、用户名和目录都应按实际环境修改。不要把真实密码、JWT 密钥或 `.env` 提交到 Git。

## 1. 部署结构

```text
浏览器
  ├─ /、/*.html、/assets/* ── Nginx ── /var/www/chesshub
  ├─ /data/figures/*       ── Nginx ── /var/www/chesshub-data/figures
  └─ /api/*                ── Nginx ── 127.0.0.1:3000
                                      └─ /opt/chesshub-server
                                         ├─ server.js / src/
                                         ├─ node_modules/
                                         ├─ .env
                                         └─ data/chesshub.db
```

需要长期保存、迁移和备份的生产数据只有三类：

1. `/opt/chesshub-server/data/`：SQLite 数据库。
2. `/var/www/chesshub-data/figures/`：上传图片。
3. `/opt/chesshub-server/.env`：生产环境配置和密钥。

前端目录和后端源码都可以由 Git 仓库重新构建，不能代替以上三类数据的备份。

## 2. 本地环境与完整验证

建议安装 Node.js 20 LTS、npm、Python 3、Git 和可用的 `tar`。仓库根目录执行：

```powershell
npm ci
npm run verify
```

`npm run verify` 会依次完成：

- 前端 TypeScript 检查和 Vite 生产构建；
- 后端接口、安全、数据库迁移与回归测试。

### 2.1 前端单独编译

```powershell
npm run build --workspace chesshub-site
```

产物位于 `apps/web/dist/`。本地预览：

```powershell
npm run preview --workspace chesshub-site
```

前端是静态文件，不需要在生产服务器运行 Vite。

### 2.2 后端检查

后端目前是原生 JavaScript，不需要转译编译；生产前需要检查语法和运行测试：

```powershell
npm run check --workspace chesshub-server
npm run test --workspace chesshub-server
```

如 `package.json` 或 lockfile 有变化，生产服务器必须重新运行 `npm ci --omit=dev`。

## 3. 当前服务器的日常部署

部署脚本默认连接 `scripts/deploy/*.py` 中配置的服务器，并优先使用 SSH 密钥。首次使用：

```powershell
python -m pip install paramiko
ssh ubuntu@服务器IP
```

确认密钥登录及免交互 `sudo -n` 可用。不要将密码写进脚本；尚未配置密钥时，只能临时设置：

```powershell
$env:SSH_PASS='临时密码'
```

### 3.1 只部署前端

```powershell
npm run build --workspace chesshub-site
New-Item -ItemType Directory -Force artifacts
tar -czf artifacts/chesshub-dist.tar.gz -C apps/web/dist .
python scripts/deploy/frontend.py
```

脚本会：

1. 备份当前 `/var/www/chesshub` 到服务器 `/tmp/`；
2. 上传前端压缩包；
3. 替换 HTML、assets 和构建产物；
4. 检查 Nginx 状态与监听端口。

适用场景：页面、样式、前端逻辑和静态资源更新。

### 3.2 只部署后端源码

```powershell
python scripts/deploy/backend.py
```

脚本会：

1. 备份服务器上的后端源码和数据库到 `/tmp/`；
2. 上传 `server.js` 与 `src/`；
3. 执行 Node.js 语法检查；
4. 重启 `chesshub-server` PM2 进程；
5. 请求 `/api/health` 验证服务。

注意：这个快捷脚本不会上传 `package.json`、lockfile 或重新安装依赖。依赖变化时应采用“完整后端部署”。

### 3.3 前后端一起更新

```powershell
npm run verify
python scripts/deploy/backend.py
tar -czf artifacts/chesshub-dist.tar.gz -C apps/web/dist .
python scripts/deploy/frontend.py
```

推荐顺序是先后端、再前端，避免新版前端先调用尚未上线的新接口。

### 3.4 部署后检查

```bash
curl -fsS http://127.0.0.1:3000/api/health
sudo pm2 status
sudo nginx -t
systemctl is-active nginx
curl -I http://127.0.0.1/
```

再人工确认：首页、工作与学习、生活分享、搜索、登录和管理中心。

## 4. 新服务器首次部署

### 4.1 安装基础环境

```bash
sudo apt update
sudo apt install -y nginx git curl build-essential python3
node --version
npm --version
sudo npm install -g pm2
```

Node.js 版本应为 20 或更高。如 Ubuntu 仓库提供的版本过旧，应通过可信的 Node.js 20 LTS 安装渠道安装。

### 4.2 创建目录

```bash
sudo mkdir -p /var/www/chesshub
sudo mkdir -p /var/www/chesshub-data/figures
sudo mkdir -p /opt/chesshub-server/data
sudo chown -R ubuntu:ubuntu /var/www/chesshub /var/www/chesshub-data /opt/chesshub-server
```

### 4.3 上传并安装后端

在本地制作完整后端包：

```powershell
tar -czf artifacts/chesshub-server.tar.gz -C apps/api server.js src package.json package-lock.json .env.example
scp artifacts/chesshub-server.tar.gz ubuntu@服务器IP:/tmp/
```

服务器执行：

```bash
tar -xzf /tmp/chesshub-server.tar.gz -C /opt/chesshub-server
cd /opt/chesshub-server
npm ci --omit=dev
cp .env.example .env
chmod 600 .env
```

编辑 `.env`，至少配置：

```dotenv
ADMIN_USER=你的管理员账号
ADMIN_PASS=高强度独立密码
JWT_SECRET=至少32字节的随机字符串
PORT=3000
UPLOAD_DIR=/var/www/chesshub-data/figures
CORS_ORIGIN=https://你的域名
PUBLIC_BASE_URL=
```

可生成 JWT 密钥：

```bash
openssl rand -hex 32
```

启动服务：

```bash
cd /opt/chesshub-server
pm2 start server.js --name chesshub-server
pm2 save
pm2 startup
```

执行 `pm2 startup` 输出的那条 `sudo` 命令，再运行一次 `pm2 save`。建议始终由同一个普通用户管理 PM2，避免一部分命令使用 root、一部分使用 ubuntu。

### 4.4 上传前端

本地执行：

```powershell
npm run build --workspace chesshub-site
tar -czf artifacts/chesshub-dist.tar.gz -C apps/web/dist .
scp artifacts/chesshub-dist.tar.gz ubuntu@服务器IP:/tmp/
```

服务器执行：

```bash
sudo tar -xzf /tmp/chesshub-dist.tar.gz -C /var/www/chesshub
sudo chown -R www-data:www-data /var/www/chesshub
```

### 4.5 配置 Nginx

创建 `/etc/nginx/sites-available/chesshub`：

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name example.com www.example.com;

    root /var/www/chesshub;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /data/figures/ {
        alias /var/www/chesshub-data/figures/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

启用并检查：

```bash
sudo ln -s /etc/nginx/sites-available/chesshub /etc/nginx/sites-enabled/chesshub
sudo nginx -t
sudo systemctl reload nginx
```

配置 DNS 指向新服务器后，再使用 Certbot 或云厂商证书配置 HTTPS。HTTPS 生效后，把 `.env` 的 `CORS_ORIGIN` 改为正式域名并重启后端。

## 5. 更换服务器

迁移原则是“先在新服务器恢复并验证，再切换 DNS，最后保留旧服务器一段时间”。不要先关闭旧服务器。

### 5.1 在旧服务器制作迁移包

先短暂停止写入。最稳妥的方式是暂停后端，避免复制 SQLite 时仍有写操作：

```bash
sudo pm2 stop chesshub-server
STAMP=$(date +%Y%m%d-%H%M%S)
sudo tar -czf /tmp/chesshub-migration-$STAMP.tar.gz \
  /opt/chesshub-server/data \
  /opt/chesshub-server/.env \
  /var/www/chesshub-data/figures
sudo pm2 start chesshub-server
sudo sha256sum /tmp/chesshub-migration-$STAMP.tar.gz
```

将压缩包下载到受保护的本地目录。该文件包含管理员密码与 JWT 密钥，不能上传 GitHub、网盘公开链接或聊天工具。

### 5.2 在新服务器恢复

先完成第 4 节的基础环境、源码、依赖和目录部署，再上传迁移包：

```bash
sudo tar -xzf /tmp/chesshub-migration-时间戳.tar.gz -C /
sudo chown -R ubuntu:ubuntu /opt/chesshub-server
sudo chown -R www-data:www-data /var/www/chesshub-data
cd /opt/chesshub-server
npm ci --omit=dev
pm2 restart chesshub-server
```

应用启动时会自动执行兼容性数据库迁移。不要手工删除或重建 `chesshub.db`。

### 5.3 切换前验证

不改 DNS 时，可直接针对新服务器 IP 检查：

```bash
curl -fsS http://127.0.0.1:3000/api/health
curl -I http://新服务器IP/
```

还应核对：

- 内容总数和分类数量；
- 最新文章与历史版本；
- 图片能否加载；
- 管理员登录、编辑和上传；
- 回收站、定时发布和搜索；
- Nginx、PM2 和系统重启后的自动启动。

确认无误后降低 DNS TTL、切换 A/AAAA 记录，重新签发 HTTPS 证书。旧服务器建议只读保留 3～7 天，确认没有流量和数据遗漏后再释放。

### 5.4 迁移后必须修改的配置

- `scripts/deploy/backend.py` 的 `HOST`、`USER` 和远端目录；
- `scripts/deploy/frontend.py` 的 `HOST`、`USER` 和远端目录；
- `apps/api/chesshub-deploy.sh` 中的 IP、域名和目录；
- `apps/web/public/robots.txt` 与 `sitemap.xml` 中的正式站点地址；
- 云安全组、防火墙、DNS、HTTPS 和备份任务。

长期建议把服务器地址改成环境变量，避免每次换服务器都修改脚本源码。

## 6. 自动备份与恢复演练

仓库提供 `apps/api/tests/chesshub-backup.sh` 模板，可安装到 `/etc/cron.daily/chesshub-backup.sh`。默认备份：数据库、`.env` 和上传图片，并保留 7 天。

备份完成不等于可恢复。至少每月执行一次恢复演练：

```bash
mkdir -p /tmp/chesshub-restore-test
tar -xzf /var/backups/chesshub/某次备份/data.tar.gz -C /tmp/chesshub-restore-test
tar -tzf /var/backups/chesshub/某次备份/uploads.tar.gz >/dev/null
```

备份最好再同步一份到另一台机器或私有对象存储；只保存在同一块服务器磁盘上无法应对磁盘损坏或主机丢失。

## 7. 回滚

### 前端回滚

部署脚本会在 `/tmp/chesshub-web-backup-时间戳.tar.gz` 保留部署前版本：

```bash
sudo rm -rf /var/www/chesshub/assets /var/www/chesshub/*.html
sudo tar -xzf /tmp/chesshub-web-backup-时间戳.tar.gz -C /var/www/chesshub
sudo nginx -t && sudo systemctl reload nginx
```

### 后端回滚

```bash
sudo tar -xzf /tmp/chesshub-api-backup-时间戳.tar.gz -C /opt/chesshub-server
sudo cp /tmp/chesshub-db-backup-时间戳.db /opt/chesshub-server/data/chesshub.db
cd /opt/chesshub-server
sudo pm2 restart chesshub-server
curl -fsS http://127.0.0.1:3000/api/health
```

恢复数据库会丢失备份时间之后的新内容，只应在数据库迁移或数据损坏时使用。普通代码故障优先只回滚源码。

## 8. 常见故障

### 网站能打开，但 API 请求失败

```bash
curl -v http://127.0.0.1:3000/api/health
sudo pm2 logs chesshub-server --lines 100
sudo nginx -t
```

检查 PM2 进程、端口 3000、Nginx `/api/` 代理和 `.env`。

### 图片返回 404

检查 `UPLOAD_DIR`、Nginx alias 和文件权限：

```bash
grep UPLOAD_DIR /opt/chesshub-server/.env
ls -la /var/www/chesshub-data/figures | head
sudo nginx -T | grep -A5 'location /data/figures/'
```

### PM2 显示进程不存在

PM2 进程按 Linux 用户隔离。确认最初是由 `ubuntu` 还是 root 启动，并使用同一用户执行 `pm2 status`。新服务器建议统一由普通部署用户运行。

### `git pull` 分支错误

```bash
git fetch --prune origin
git branch --set-upstream-to=origin/main main
git pull --ff-only
```

生产服务器不必依赖 `git pull`；使用经过本地验证的构建包更容易回滚，也能避免把未安装依赖的源码直接上线。

## 9. 安全检查清单

- SSH 只使用密钥，关闭密码登录和 root 直接登录；
- 云安全组只开放 22、80、443，后端 3000 只监听 `127.0.0.1`；
- `.env` 权限为 600，管理员密码和 JWT 密钥不复用；
- HTTPS 开启后强制跳转 HTTPS；
- 定期更新 Ubuntu、Nginx、Node.js 和 npm 依赖；
- 备份离机保存，并实际演练恢复；
- 服务器密码或密钥一旦在聊天、日志或仓库中暴露，立即轮换。
