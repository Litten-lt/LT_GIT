# ChessHub 个人主页

`chesshub.fun` 个人主页 — React + TS + Vite + Tailwind，二次元 / 赛博风。

## 本地开发

```bash
npm install
npm run dev          # http://localhost:5173
```

## 构建

```bash
npm run build        # 输出 dist/
```

## 部署到服务器 (chesshub.fun)

整体流程：**本地构建 → scp 到服务器 → 服务器解包 → Nginx 托管**。

### 一次性准备（服务器）

SSH 上服务器后执行一次：

```bash
# 上传脚本
scp deploy-server.sh root@159.75.97.172:/root/

# 服务器端
ssh root@159.75.97.172
bash /root/deploy-server.sh
```

服务器脚本会自动：
- 安装 Nginx / Certbot / Node
- 申请 Let's Encrypt HTTPS 证书
- 配置 Nginx（域名 + 五子棋子路径）
- 配防火墙（22/80/443）

### 日常更新

在本地：

```bash
# 1. 构建并打包
bash build-and-pack.sh both

# 2. 上传到服务器
scp /tmp/chesshub-dist.tar.gz root@159.75.97.172:/tmp/
scp /tmp/gobang-dist.tar.gz root@159.75.97.172:/tmp/

# 3. 服务器上解包
ssh root@159.75.97.172
sudo tar -xzf /tmp/chesshub-dist.tar.gz -C /var/www/chesshub/
sudo tar -xzf /tmp/gobang-dist.tar.gz -C /var/www/gobang/
sudo systemctl reload nginx
```

## 域名配置（重要！）

部署前**必须**在域名服务商把 `chesshub.fun` 解析到 `159.75.97.172`：

```
A 记录:  @        → 159.75.97.172
A 记录:  www      → 159.75.97.172
```

DNS 生效后 Let's Encrypt 才能签出证书。

## 目录结构

```
chesshub-site/
├── src/
│   ├── App.tsx              # 主页壳
│   ├── components/
│   │   ├── Hero.tsx         # 头部介绍
│   │   ├── IdentityTags.tsx # 身份标签卡
│   │   ├── Projects.tsx     # 项目展示
│   │   ├── Contact.tsx      # 联系方式
│   │   ├── Footer.tsx       # 页脚
│   │   └── Sakura.tsx       # 樱花飘落效果
│   ├── index.css            # 全局样式 + Tailwind
│   └── main.tsx
├── index.html
├── deploy-server.sh         # 服务器端一键脚本
├── build-and-pack.sh        # 本地构建脚本
└── package.json
```

## 线上 URL

- `https://chesshub.fun/` — 个人名片主页
- `https://chesshub.fun/gobang/` — 五子棋联机

## TODO（迭代计划）

- [ ] 上传 Blender 渲染的 avatar
- [ ] 加博客模块（Hexo / Markdown）
- [ ] 把卡牌 Hub MVP 搭起来
- [ ] 接入 Uptime Kuma 监控