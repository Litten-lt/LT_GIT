# 域名上线记录

- 正式入口：https://chesshub.fun/zhimu/
- 域名：chesshub.fun；www.chesshub.fun 跳转到主域名，路径和查询参数保留。
- 两个域名的 HTTP 均跳转 HTTPS；ACME 验证目录保留。
- Let's Encrypt 证书覆盖两个域名，本次有效期至 2027-02-08。
- certbot.timer 已启用；deploy hook 检查并重载 Nginx。
- 编辑发布退出、连续空格和编号列表修复已部署。本地及服务器各 18 项测试通过。
- 部署前数据库和图片备份：/var/backups/zhimu/predeploy-20261110-141332.db 及对应 uploads.tar.gz。

## 备案进度与后续

1. 已在网站页脚添加湘ICP备2026053285号-1，链接 https://beian.miit.gov.cn/ 。
2. 公安联网备案申请已提交，正在等待审核。准备域名 chesshub.fun、网站名称（以 ICP 备案登记为准）、公网 IP 159.75.97.172、接入商腾讯云及主体/负责人信息。网站实际应用名称为知木，填报信息需与真实登记一致。
3. 公安备案通过后，使用平台提供的备案号、图标和查询链接添加页脚。

未读取或重置线上管理员密码；真实账号登录还需用户验收。
