# 知木登录、域名与备份

## 已完成

- 单管理员 `allen`，不开放注册；手机和电脑使用同一套网页登录。
- 游客可读已发布知识；所有写入接口、草稿、回收站和未公开图片需登录。
- 密码使用带随机盐的 scrypt 哈希；会话使用随机凭证，数据库只存凭证哈希，有效期 7 天。
- 生产 Cookie 为 HttpOnly、Secure、SameSite=Strict，限定 `/zhimu`；跨站写入拒绝，登录连续失败限流。
- 首次登录强制修改初始密码；修改密码使所有设备会话失效。支持退出登录。
- 生产环境拒绝通过 HTTP 登录，HTTP 页面不展示密码输入表单；本机 localhost/127.0.0.1 开发入口可登录。

初始账号信息位于本机受限目录 `../zhimu-local/zhimu-operations/admin-credentials.json`，不纳入 Git，也未输出到聊天或日志。服务器初始化用的明文凭证文件已删除。首次改密后该初始密码作废。**本地与服务器是独立数据库，各自修改密码，不自动同步。**

本地服务：http://127.0.0.1:3210/?view=login

## 域名当前未完成事项

截图显示域名到期日为 2027-05-09；根域及 www 的 A 记录均正确指向 `159.75.97.172`，无需新增解析。

服务器证书已在 2026-08-07 到期。2026-11-02 尝试 Certbot 续签失败：域名 HTTP 的 ACME 验证路径被转到腾讯云备案提示页 `https://dnspod.qcloud.com/static/webblock.html`，未到达服务器的验证处理。

腾讯云备案提示页使用的公开状态查询接口于 2026-11-02 返回 `GovStatus=false`、`LandedStatus=false`、`AuditTicket=false`、`Ban=false`。这表示该查询没有识别到备案与接入信息；用户反馈已有备案，需要用准确备案号及控制台状态进一步核对，不能据此认定用户从未备案。

证书尚未续签成功，HTTPS 与自动续期验证**未完成**。Certbot 定时器原已启用，但验证路径拦截未解决，不能将其视为续期正常。没有绕过浏览器证书警告，没有新增重复 DNS 记录。

## 自动备份

服务器：

- `zhimu-backup.timer` 每天北京时间 03:10 开始，附加最多 120 秒随机延迟；关机错过会补执行。
- `zhimu-backup.service` 使用文件锁防重入，调用当前 release 的 `scripts/automatic-backup.mjs`。
- 数据库通过 SQLite 在线一致性备份，图片单独复制后一并打包，含 `manifest.json`。
- 每次生成后实际解压到隔离目录，检查 SQLite 完整性、外键和所有图片文件；成功后才替换 latest。
- `/var/backups/zhimu/automatic/` 保留 7 份日备份、4 份周备份和最新副本；`status.json` 记录最近成功时间。其他部署前备份不受该保留策略影响。

异机副本：

- Windows 任务 `Zhimu Daily Offsite Backup` 每天北京时间 09:10 和当前用户登录时执行。仅在当前用户登录环境运行；错过后补执行，失败每 15 分钟重试、最多 3 次。
- 使用专用加密 Ed25519 私钥，口令由 Windows 当前用户 DPAPI 加密，目录 ACL 仅当前用户和 SYSTEM 可访问。
- 服务器公钥记录已固定。远程 SSH key 设置 `restrict` 和固定 `cat /home/ubuntu/.zhimu-backup/latest.tar.gz` 命令；它不能执行任意 shell 或转发端口。
- 下载目录：`../zhimu-local/zhimu-offsite-backups/`，保留 7 份日备份和 4 份周备份；网络传输不依赖当前异常的域名 HTTPS。
- 电脑未开机或用户未登录时，服务器备份照常运行；本机副本要等下次登录或任务触发才能更新。

已执行真实服务器备份、Windows 计划任务和下载后的本地隔离恢复。恢复结果：SQLite `ok`，187 篇知识、27 次记录、1 个管理员，所有图片存在。18 项自动化测试通过。

## 日常检查与恢复

服务器查看：`systemctl list-timers zhimu-backup.timer`、`journalctl -u zhimu-backup.service` 和备份目录 `status.json`。

本机查看：任务计划程序中的 `Zhimu Daily Offsite Backup`；下载目录 `status.json` 记录成功时间，失败原因保存在 `last-error.txt`。已验证任务 `LastTaskResult=0`。

恢复时先停止知木服务，保留当前数据库和图片；在隔离目录解压并验证备份，再将 `zhimu.db` 与 `uploads/` 一并恢复至 `/opt/zhimu-data/`，处理旧 WAL/SHM 时必须确保服务已停止。数据库内含管理员哈希与会话信息，因此备份不可公开分发。恢复完成建议重新登录并使旧会话失效。

相关代码：`zhimu/src/auth.js`、`zhimu/scripts/automatic-backup.mjs`、`zhimu/scripts/pull-backup.py`、`zhimu/scripts/pull-backup.ps1`。本机任务运行的是受限运维目录中的脚本副本；修改源脚本后需同步该副本。`install-operations.py` 为首次安装工具，拒绝覆盖已存在管理员。
