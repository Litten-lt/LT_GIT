# LongTeng Personal Site

个人网站采用前后端分离结构。仓库根目录只保留项目入口、文档和可复用工具。

## 目录

```text
apps/
  web/             React + Vite 前端
  api/             Express + SQLite 后端
docs/
  archive/         历史部署记录
scripts/
  deploy/          当前生产部署工具
artifacts/         本地构建包（不提交）
```

## 本地开发

前端：

```bash
cd apps/web
npm install
npm run dev
```

后端：

```bash
cd apps/api
npm install
cp .env.example .env
npm run dev
```

## 验证

```bash
cd apps/web && npm run build
cd apps/api && node --test tests/*.test.mjs
```

生产部署说明见 [docs/deployment.md](docs/deployment.md)。
