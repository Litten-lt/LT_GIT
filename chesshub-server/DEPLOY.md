# ChessHub 一键部署脚本

`chesshub-deploy.sh` 是专门给这个项目用的一键部署工具。

## 🚀 日常更新流程（3 步）

### 本地（你 Windows 这边）

```powershell
# 1. 前端构建
cd C:\Users\LongTeng\Desktop\Allen\LT_GIT\chesshub-site
npm run build
tar -czf "$env:TEMP\chesshub-dist.tar.gz" -C dist .

# 2. 后端打包
cd ..\chesshub-server
tar -czf "$env:TEMP\chesshub-server.tar.gz" --exclude=node_modules --exclude=.env --exclude=data .

# 3. 上传
scp C:\Users\LongTeng\.mavis\.opencode\tmp\chesshub-dist.tar.gz root@159.75.97.172:/tmp/
scp C:\Users\LongTeng\.mavis\.opencode\tmp\chesshub-server.tar.gz root@159.75.97.172:/tmp/
```

### 服务器（SSH 上跑一行）

```bash
cd /opt/chesshub-server && ./chesshub-deploy.sh all
```

**完事。** 整个流程 ~30 秒。

## 🛠️ 脚本支持的子命令

```bash
./chesshub-deploy.sh all           # 全流程 (推荐)
./chesshub-deploy.sh frontend      # 只更新前端
./chesshub-deploy.sh backend       # 只更新后端
./chesshub-deploy.sh nginx         # 只重写 nginx 配置
./chesshub-deploy.sh restart       # 只重启后端
./chesshub-deploy.sh smoke-test    # 只验证服务是否正常
./chesshub-deploy.sh preflight     # 只检查环境
./chesshub-deploy.sh seed          # 只 seed aobing.jpg
./chesshub-deploy.sh clean         # 清理 /tmp/ 旧备份 (保留最近 5 份)
./chesshub-deploy.sh orphans       # 列出孤儿文件 (数据库没引用但磁盘上有)
./chesshub-deploy.sh clean-orphans 交互式删除孤儿文件
./chesshub-deploy.sh help          # 帮助
```

## 🛡️ 自保护机制

脚本会在 **`deploy_backend` 清空目录之前**自动备份自身到 `/tmp/.chesshub-deploy.sh.bak`，并在脚本退出时（`trap EXIT`）自动恢复。

也就是说：**即使 `rm -rf $BACKEND_ROOT/*` 把脚本自己删了，下次跑也会自动从 `/tmp/` 恢复**。

如果脚本出问题了，从 `/tmp/.chesshub-deploy.sh.bak` 也能手动恢复：
```bash
cp /tmp/.chesshub-deploy.sh.bak /opt/chesshub-server/chesshub-deploy.sh
chmod +x /opt/chesshub-server/chesshub-deploy.sh
```

## 🖼️ 上传目录保护 + 孤儿文件检测

部署脚本**不会动** `/var/www/chesshub-data/figures/`（用户上传目录），但**会在每次部署前自动备份**到 `/tmp/chesshub-uploads-backup-YYYYMMDD-HHMMSS/`。

部署完后自动跑 **孤儿检测**：
- 读数据库所有 figures.images
- 扫上传目录所有 .jpg/.jpeg/.png/.webp
- 列出**数据库没引用但磁盘上存在的文件**（"孤儿"）
- **只列出，不自动删**

孤儿产生原因：
- 编辑时上传了新图但**保存失败**（token 过期、误点取消）
- 编辑时**删了某张图**，但 PUT 端点 diff 算法没识别到

### 清理孤儿

```bash
# 1. 先看有哪些
./chesshub-deploy.sh orphans

# 2. 确认后交互式删除(会问 y/N)
./chesshub-deploy.sh clean-orphans
```

## 📦 部署前准备

1. **首次部署**（全新服务器）：先在服务器上跑一次 `./chesshub-deploy.sh preflight`，看环境缺啥
2. **缺失的依赖**（脚本报错会提示）：
   - Node.js 20+ → `apt install -y nodejs` 或 `nvm`
   - pm2 → `npm i -g pm2`
   - nginx → `apt install -y nginx`
3. **必建的目录**：
   - `/var/www/chesshub/` — 前端 dist
   - `/var/www/chesshub-data/figures/` — 上传图片
   - `/var/www/gobang/` — 五子棋（独立的 React + TS 项目）

## 🛡️ 脚本安全保障

- ✅ **自动备份** `data/` 和 `.env` 到 `/tmp/chesshub-*-backup-*`（带时间戳）
- ✅ **幂等**：可以多次跑，不会有副作用
- ✅ **失败立即停**：`set -e`，任何阶段出错立即退出
- ✅ **冒烟测试**：部署完自动跑 curl 验证

## ⚠️ 不会自动做的事 [MANUAL]

脚本报错后会列出这些**需要你单独操作**的事：

1. **改 admin 密码** —— 编辑 `/opt/chesshub-server/.env` 里的 `ADMIN_PASS`
2. **域名 DNS 解析** —— 在域名服务商控制台把 `chesshub.fun` 指向 `159.75.97.172`
3. **HTTPS 证书** —— DNS 生效后跑 `certbot --nginx -d chesshub.fun`
4. **Google OAuth 设置**（如果以后改用 Google 登录）

## 🆘 部署失败怎么办

脚本会停在第一个失败的阶段，**不要慌**：

1. 看终端的报错（脚本会用 `[✗]` 标红）
2. 看 `pm2 logs chesshub-server --lines 50`
3. 看 `tail -30 /var/log/nginx/chesshub.error.log`
4. 把报错贴给我，我帮你看

## 📂 服务器目录结构

```
/opt/chesshub-server/         # 后端 Node.js
├── chesshub-deploy.sh         # ← 这个脚本
├── server.js                  # 主程序
├── package.json
├── .env                       # 配置 (含 admin 凭据 + JWT secret)
├── data/
│   └── chesshub.db            # SQLite 数据
└── node_modules/

/var/www/chesshub/            # 前端 vite 产物 (静态)
├── index.html
├── assets/
├── login.html
├── figures.html
├── figures/                   # seed 用的 aobing.jpg
└── ...

/var/www/chesshub-data/figures/  # 用户上传的图片
/var/www/gobang/               # 五子棋 (独立项目)
```

## 🔧 第一次跑要做的事

```bash
# 1. 上传脚本到服务器
scp chesshub-deploy.sh root@159.75.97.172:/opt/chesshub-server/

# 2. 加执行权限
ssh root@159.75.97.172
chmod +x /opt/chesshub-server/chesshub-deploy.sh

# 3. 跑一遍
cd /opt/chesshub-server
./chesshub-deploy.sh preflight   # 先看环境
./chesshub-deploy.sh all         # 全跑
```

之后日常更新只需要 `./chesshub-deploy.sh all`。