# 仓库根目录迁移

完成日期：2026-11-05。

## 唯一项目根目录

`C:/Users/LongTeng/Desktop/Allen/LT_GIT/zhimu`

Git 元数据、CI、开发规则、文档和应用代码均在此目录。完整历史保留，没有重建空仓库或改写历史。外层不再是 Git 仓库，不再保留转发用 package.json、锁文件或 README。

外层只保留：

- `zhimu/`：唯一项目与 Git 仓库。
- `zhimu-local/`：项目外运维资料、异机备份、旧站归档和仓库迁移归档。

## 调整

- `.git`、`.github`、`.agents`、`docs` 移入项目，合并忽略规则，更新 README。
- CI 工作目录与锁文件路径改为仓库根目录。
- npm 直接运行本项目脚本，无外层代理；部署命令为 `npm run deploy`。
- 本机备份资料从外层 `artifacts/` 移至 `zhimu-local/`，路径、任务动作与工作目录同步修改；DPAPI 密钥保护保持不变。
- 运维安装脚本默认使用旁边的 `zhimu-local`，支持 `ZHIMU_LOCAL_DIR` 覆盖。
- 服务器服务、地址与正式数据库未因本次本地整理发生变更。

## 验证

- Git 顶层路径为上述 zhimu 目录，旧提交仍为当前历史祖先。
- 本地 18 项测试通过，Markdown/Mermaid 构建完成。
- 本地数据库完整性检查通过。
- Windows 备份任务 2026-11-05 10:58 运行成功，LastTaskResult=0；下载地址指向新目录。下载归档隔离恢复后完整性与外键检查通过，187 篇知识、27 次记录。
- 数据库、依赖、环境配置、密钥等不纳入 Git。

迁移前完整 Git bundle：`../zhimu-local/repository-migration-20261105/before-root-move.bundle`。原外层清单和备份任务 XML 也保留在该目录。迁移通过本地快照提交保存，没有推送远端。

后续在编辑器或 Codex 中打开本项目根目录进行开发。
