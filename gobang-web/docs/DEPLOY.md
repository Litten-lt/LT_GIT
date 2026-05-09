# chesshub.fun 部署指南

## 1. 服务器信息

| 项目 | 值 |
|------|-----|
| 服务器 | 腾讯云轻量应用服务器 |
| 系统 | Ubuntu 22.04 LTS |
| 公网 IP | 159.75.97.172 |
| 域名 | chesshub.fun |
| HTTPS | Let's Encrypt 免费证书 |

---

## 2. 服务架构

```
                         Internet
                            ↓
              ┌─────────────────────────┐
              │        Nginx           │
              │    (443 HTTPS + 80)    │
              │    chesshub.fun        │
              └───────────┬───────────┘
                          │
          ┌───────────────┼───────────────┐
          ↓               ↓               ↓
    ┌───────────┐   ┌─────────────┐   ┌──────────┐
    │  静态资源  │   │  Socket.IO  │   │  API...  │
    │ :80/:443   │   │   :3001     │   │          │
    └───────────┘   └─────────────┘   └──────────┘
```

---

## 3. 部署步骤概览

| 阶段 | 操作 | 预计时间 |
|------|------|----------|
| 1. 环境准备 | 安装 Nginx, Node.js, PM2 | 15 分钟 |
| 2. SSL 证书 | Let's Encrypt 申请 | 10 分钟 |
| 3. 代码配置 | 修改 CORS 和 SERVER_URL | 5 分钟 |
| 4. 构建上传 | npm run build + SCP 上传 | 10 分钟 |
| 5. 服务启动 | PM2 启动 + Nginx 配置 | 10 分钟 |
| 6. 验证测试 | 访问网站测试功能 | 5 分钟 |

---

## 4. 详细部署步骤

### 4.1 服务器环境准备

```bash
# 更新系统包
sudo apt update && sudo apt upgrade -y

# 安装 Nginx
sudo apt install -y nginx

# 安装 Node.js (通过 nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install --lts
nvm use --lts

# 验证安装
node --version
npm --version

# 安装 PM2
npm install -g pm2
```

### 4.2 DNS 配置

在腾讯云 DNS 解析控制台添加 A 记录：

| 主机记录 | 记录类型 | 记录值 |
|----------|----------|--------|
| @ | A | 159.75.97.172 |
| www | A | 159.75.97.172 |

等待 5-30 分钟生效后验证：
```bash
nslookup chesshub.fun
```

### 4.3 SSL 证书申请

```bash
# 安装 Certbot
sudo apt install -y certbot python3-certbot-nginx

# 申请证书
sudo certbot --nginx -d chesshub.fun
# 选择 "1: Keep the existing certificate for now"（如果已有证书）

# 证书位置
/etc/letsencrypt/live/chesshub.fun/
```

### 4.4 本地代码配置修改

#### 4.4.1 修改服务器 CORS 配置
文件：`server/src/index.ts`
```typescript
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: ['https://chesshub.fun'],  // 改为你的域名
    methods: ['GET', 'POST'],
  },
});
```

#### 4.4.2 修改客户端连接地址
文件：`src/hooks/useOnlineGame.ts`
```typescript
const SERVER_URL = 'https://chesshub.fun';  // 改为你的域名
```

### 4.5 构建和上传

```bash
# 本地执行构建
cd gobang-web
npm run build        # 构建客户端
cd server
npm run build       # 构建服务端

# 上传到服务器
scp -r dist/* root@159.75.97.172:/var/www/chesshub/
scp -r server root@159.75.97.172:/var/www/chesshub/
```

### 4.6 服务器配置

#### 4.6.1 Nginx 配置
```bash
sudo nano /etc/nginx/sites-available/chesshub
```

内容：
```nginx
server {
    listen 80;
    server_name chesshub.fun;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name chesshub.fun;

    ssl_certificate /etc/letsencrypt/live/chesshub.fun/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/chesshub.fun/privkey.pem;

    root /var/www/chesshub/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /socket.io/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

#### 4.6.2 启用配置
```bash
# 删除默认站点（避免冲突）
sudo rm /etc/nginx/sites-enabled/default

# 启用 chesshub 配置
sudo ln -sf /etc/nginx/sites-available/chesshub /etc/nginx/sites-enabled/

# 测试并重载
sudo nginx -t
sudo systemctl reload nginx
```

### 4.7 服务启动

```bash
# 安装服务端依赖
cd /var/www/chesshub/server
npm install

# 启动服务
pm2 start dist/index.js --name gobang-server

# 保存配置
pm2 save

# 设置开机自启
pm2 startup
```

### 4.8 防火墙配置（重要）

在腾讯云控制台安全组开放以下端口：

| 端口 | 协议 | 说明 |
|------|------|------|
| 80 | TCP | HTTP 重定向 |
| 443 | TCP | HTTPS |

---

## 5. 验证测试

### 5.1 服务器端验证
```bash
# 测试静态资源
curl https://127.0.0.1

# 测试 Socket.IO
curl https://127.0.0.1/socket.io/

# 查看 PM2 状态
pm2 status

# 查看 Nginx 日志
sudo tail -f /var/log/nginx/error.log
```

### 5.2 客户端验证
- 访问 `https://chesshub.fun`
- 测试创建房间
- 测试加入房间
- 测试在线对战

---

## 6. 常用维护命令

```bash
# 查看服务状态
pm2 status

# 查看日志
pm2 logs

# 重启服务
pm2 restart gobang-server

# 重载 Nginx
sudo systemctl reload nginx

# 查看 Nginx 配置
sudo cat /etc/nginx/sites-enabled/chesshub

# 更新代码后重新部署
# 本地重新构建并上传
npm run build
scp -r dist/* root@159.75.97.172:/var/www/chesshub/
scp -r server root@159.75.97.172:/var/www/chesshub/
# 服务器端重启
pm2 restart gobang-server
```

---

## 7. 遇到的问题及解决方案

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| certbot 申请证书失败 | DNS 未生效 | 等待 DNS 生效或检查 A 记录 |
| 403 Forbidden | root 路径错误 | 修改 root 为 `/var/www/chesshub/dist` |
| 无法连接 443 | 防火墙未开放 | 在腾讯云安全组开放 443 端口 |
| 500 错误 | 证书配置错误 | 检查 ssl_certificate 路径 |
| PM2 服务未启动 | node_modules 未安装 | `npm install` 在 server 目录 |

---

## 8. 目录结构

```
/var/www/chesshub/          # 网站根目录
├── dist/                    # 前端构建产物
│   ├── index.html
│   └── assets/
└── server/                  # 后端服务
    ├── dist/                # 编译后的 JS
    │   └── index.js
    ├── src/
    ├── package.json
    └── node_modules/
```

---

## 9. 相关文件路径

| 文件 | 路径 |
|------|------|
| Nginx 配置 | `/etc/nginx/sites-available/chesshub` |
| SSL 证书 | `/etc/letsencrypt/live/chesshub.fun/` |
| Nginx 日志 | `/var/log/nginx/error.log` |
| PM2 日志 | `pm2 logs` |

---

*文档版本: v1.0.0*
*创建日期: 2026-05-09*
*最后更新: 2026-05-09*