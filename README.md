# 森空岛签到

使用 TypeScript 实现的森空岛自动签到系统，支持多账号管理和多种推送通知方式。

核心支持在所有支持 [Web Cryptography](https://caniuse.com/cryptography) 的运行环境运行，包括浏览器、Node.js、Cloudflare Workers 等。

## 功能特点

- 🌟 支持多账号管理
- 🎮 **同时签到多个游戏**：明日方舟、明日方舟：终末地
- 🤖 自动定时执行签到任务
- 📱 支持多种推送通知方式
- 🔄 支持错误自动重试

## 支持的游戏

| 游戏 | `appCode` | `gameId` | 签到接口 |
| --- | --- | --- | --- |
| 明日方舟 | `arknights` | 1（官服）/ 2（B 服） | `POST /api/v1/game/attendance` |
| 明日方舟：终末地 | `endfield` | 3 | `POST /api/v1/game/endfield/attendance` |

两个接口形态不同，不能互相替代：

- **明日方舟**：角色用 `uid` 标识，`gameId` 传渠道号，签到参数走 body。
- **终末地**：一个账号下可能有多个区服角色，每个都要**单独**签到；
  角色信息通过 `sk-game-role: {gameId}_{roleId}_{serverId}` 请求头传递，body 为空。
  终末地的签到状态也没有 `records` 列表，改用 `hasToday` 字段判断。

绑定接口 `/api/v1/game/player/binding` 一次返回账号下所有游戏的角色，
脚本会自动筛出可签到的游戏并逐个处理，无需额外配置。

新增游戏只需在 `packages/core/src/games.ts` 的 `GAME_REGISTRY` 里加一条记录，
再按需扩展 `expandBindings()` 的摊平逻辑。

## 部署方式

本项目提供两种部署方式，请根据个人需求选择：

1. [Cloudflare Workers 版本](./apps/cloudflare/README.md)
2. [GitHub Actions 版本](./apps/node//README.md)


## 推送通知

每条推送的正文尾部都会自动附上来源与凭证状态：

```
明日方舟 官服「博士」 签到成功，获得了「龙门币」1000个
明日方舟：终末地 China「管理员」 签到成功，获得了「折金票」2000个
成功签到2个角色（明日方舟 1 / 明日方舟：终末地 1）

----------------------
来源：GitHub Actions · attendance
运行记录：https://github.com/yu-echo/skland-daily-attendance/actions/runs/123456
Token 认证日期：2026-09-18
```

- **来源**：在 GitHub Actions 里显示 `GitHub Actions` 并附运行记录直达链接；
  本机直接运行则显示 `本地运行`，便于区分消息是谁发的。
- **Token 认证日期**：`SKLAND_TOKEN` 是鹰角通行证的不透明凭据，本身不含签发时间，
  所以这里取该凭证**首次在本流水线认证成功**的日期（按 Asia/Shanghai 计），
  存在 `.skland-state.json` 里，由 `actions/cache` 跨运行保留。
  状态文件只写凭证的 SHA-256 短指纹，不会落地 token 明文。
- 若将来 `SKLAND_TOKEN` 换成 JWT，会自动改读真实的 `iat` / `exp`，
  并在推送里补上 `Token 有效期至 …（剩 N 天）`；解析不出来时不会伪造有效期。

运行失败时尾部会多一行「本次运行存在失败项，请检查运行记录」。

## 安全说明

### Token 存在哪里

`SKLAND_TOKEN` 只存在于 GitHub 的加密 Secret 中，**不在代码、不在 git 历史、不在推送正文**。
Actions 日志里它会被自动打码成 `***`。

### 仓库公开会暴露什么

仓库设为 public 时，**任何登录 GitHub 的账号都能查看运行日志**（未登录访问日志接口返回 403，
网页日志区提示 `Sign in to view`，实测如此）。日志里会出现的不是 token，而是：

- 账号昵称与角色名（例如 `明日方舟 官服「某某#1234」 今天已经签到过了`）
- 签到结果、获奖道具名
- 运行时间与提交信息

介意的话把仓库设为 **private**：Free 套餐私有仓库每月有 2000 分钟 Actions 额度，
本项目一天跑一次、单次约 1～2 分钟，一个月约 30～60 分钟，完全够用。

### 主动脱敏

推送地址本身就是凭据（`https://msgpusher.com/push/<token>`、
`https://api.day.app/<key>/`、`https://sctapi.ftqq.com/<sendkey>.send`），
而 ofetch 抛出的错误消息里**带完整请求 URL**。直接 `console.error(error)` 会把凭据写进日志。

`packages/notification/src/redact.ts` 做了两层处理：抹掉指定 URL 的 path/query，
并兜底抹掉消息里出现的任意其它链接的 path。日志里只会留下主机名：

```
[MessagePusher] Error: [POST] "https://msgpusher.com/***": 401 Unauthorized
```

GitHub 按 secret 值自动打码是最后一道防线，不该依赖它——一旦 URL 被编码、截断或日志被转发就失效。

## 注意事项

- 本项目仅用于学习和研究目的
- 请勿频繁调用 API，以免影响账号安全

## 相关项目

- [罗德岛远程指挥部](https://github.com/enpitsuLin/rhodes-headquarters) - 浏览器扩展，用于监控森空岛信息

## License

MIT
