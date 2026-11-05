# 知木 Zhimu

独立项目，使用 Express + SQLite + 原生 JavaScript，不依赖上一级网站的代码、数据库或启动命令。建议 Node 22.12 以上。已包含 Markdown/Mermaid 浏览器构建产物，修改渲染组件时需运行 `npm run build`。

## 本地

```powershell
cd zhimu
npm ci
npm start
```

默认地址 `http://127.0.0.1:3210/`。知识点管理 `?view=notes`，分支管理 `?view=branches`，回收站 `?view=trash`。

`npm run verify` 检查脚本并执行增删改查、分支循环、批次恢复、持久化和布局测试。

配置环境变量：`PORT` 默认 3210，`DATA_DIR` 默认项目下 data，`BASE_PATH` 默认空；服务器设置 `/zhimu`。服务只监听本机回环地址，Nginx 转发。

## 第一版功能

- 分支新增、查询、名称/简介编辑、移动、排序、回收和恢复。支持多层层级，拦截自引用与循环。
- 知识点标题、摘要、正文、标签、所属分支、草稿/发布状态；全文查询、分支及状态筛选、编辑与回收恢复。
- 整枝回收按批次恢复；此前单独删除的内容不被误恢复。删除分支也可以先迁移知识点和直接子分支。
- 独立知识树、封面生长过渡、文字开关、分支聚焦和分页、叶片预览、独立阅读链接。叶片文字优先显示标签，没有标签时回退到标题；预览和阅读仍显示完整标题。
- 一个知识点支持多次追加过程记录，每次记录可独立编辑、删除、配图；时间线按创建顺序展示。追加记录不新增叶片。记录支持本机临时草稿和服务器草稿。
- 主体和过程记录都支持 PNG/JPEG/GIF/WebP 图片，单张 5 MB、每次 5 张、每条内容最多 10 张；保存前可移除图片。服务端校验真实文件类型并使用独立持久化目录。
- 编辑器在本机保留未保存草稿，主动保存后写入服务端 SQLite。正文支持基础 Markdown 标题、列表、引用、粗体和代码块；不会执行正文中的 HTML。

采用单管理员登录、游客公开阅读。管理写入、草稿、回收站和未公开附件由服务端鉴权；不开放注册。生产登录强制 HTTPS，首次登录需修改初始密码。初始化通过 `scripts/provision-admin.mjs`，不在网页开放管理员创建接口。域名接入待核对，当前公网 HTTP 入口仅用于游客阅读。

已配置服务器每日备份、本机异机定时下载和真实恢复验证。账号交付、备份时间、目录、凭证保护和域名当前阻塞项见 `../docs/zhimu-operations-2026-11-02.md`。

## 服务器

```powershell
python scripts/deploy.py
```

复用已有部署连接变量 `LT_DEPLOY_HOST`、`LT_DEPLOY_USER`、`SSH_PASS` 或 SSH key/agent。不在仓库保存凭据。

- 已验证入口：`http://159.75.97.172/zhimu/`，管理 `?view=notes`，分支 `?view=branches`。
- 域名预留：`https://chesshub.fun/zhimu/`。2026-11-02 检查时现有证书已过期（到期 2026-08-07），续期因 CA 校验解析到 `43.174.224.202` 而非部署服务器失败；需检查域名 DNS/CDN/转发再续期。未绕过证书校验。
- 独立进程：PM2 `zhimu`，端口 3210。
- 代码：`/opt/zhimu/releases/<时间戳>`，`/opt/zhimu/current` 指向当前版本。
- 数据：`/opt/zhimu-data/zhimu.db`，图片 `/opt/zhimu-data/uploads/`，都不在发布包中。
- Nginx：独立 `/zhimu/` location，不替换原 `/` 或 `/api/`。
- 部署前备份数据库及 Nginx，配置检测通过后才 reload。

手动一致性备份：

```bash
cd /opt/zhimu/current
DATA_DIR=/opt/zhimu-data node scripts/backup.mjs /var/backups/zhimu/manual.db
```

备份命令会同时生成 SQLite 快照及旁边的 `.uploads.tar.gz` 图片包，恢复时须同时保留两者。

代码回滚：将 `/opt/zhimu/current` 切回前一 release，再 `sudo pm2 restart zhimu`；数据库独立保留。不要直接覆盖正在使用的 SQLite 文件。

## 数据边界与后续

新服务初始为空，不自动导入旧网站笔记。2026-11-02 已按确认范围完成一次正式迁移：187 篇知识、27 次追加记录、1 张图片；17 篇目录导读未导入。迁移说明、分类与备份位置见 `../docs/zhimu-original-import-2026-11-02.md`。`scripts/migrate-original.mjs` 是显式覆盖式导入工具，不应在后续积累正式数据后再次覆盖执行。

阅读页与编辑预览支持 Markdown 表格及 Mermaid 图表；工具栏可插入示例，宽表格与图表可横向滚动，图表可展开源码。内部链接暂按普通文字显示。原始历史版本已随迁移快照归档，暂不包含版本历史界面、非图片附件、多人权限和自由拖拽布局。树形为自动概览布局，分支较多时通过聚焦和目录查找。

修改 `client/markdown.js` 后执行 `npm run build` 生成本站使用的 `public/vendor/` 资源，再部署；无需外部 CDN。

## 独立部署（2026-11-05）

Nginx 配置由本项目 `deploy/nginx.conf` 与 `deploy/site.conf` 管理，不再依赖旧站。网站根路径跳转 `/zhimu/`；旧 `/api/` 不再转发。旧 API 服务已退役。源码清理与归档见 `../docs/zhimu-independent-deployment-2026-11-05.md`。
