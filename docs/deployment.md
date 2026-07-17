# 生产部署

仓库保留两份正式部署工具，密码只通过环境变量 `SSH_PASS` 传入，不写入代码。

## 前端

```powershell
cd apps/web
npm run build
New-Item -ItemType Directory -Force ../../artifacts
# 在 Git Bash 中执行：
tar -czf ../../artifacts/chesshub-dist.tar.gz -C dist .
cd ../..
$env:SSH_PASS='服务器密码'
python scripts/deploy/frontend.py
```

前端脚本会先备份 `/var/www/chesshub`，再上传并替换静态文件，最后检查 nginx。

## 后端

```powershell
$env:SSH_PASS='服务器密码'
python scripts/deploy/backend.py
```

后端脚本会备份当前 `server.js` 和数据库，只替换服务入口，执行语法检查后重启 PM2 并检查健康接口。

## 完整服务器部署

首次安装、nginx 配置、备份与恢复仍由 `apps/api/chesshub-deploy.sh` 负责。日常内容和界面更新优先使用上面的两个小型部署工具。

## 安全要求

- 不在脚本、文档或命令历史中保存真实密码。
- 部署前确认本地构建和测试通过。
- 后端部署前确认服务器备份空间充足。
