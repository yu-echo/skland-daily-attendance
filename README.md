<!-- markdownlint-disable MD033 MD041 -->

<div align="center">
  <h1>🏝️ 森空岛自动签到</h1>
  <img alt="license" src="https://img.shields.io/github/license/yu-echo/skland-daily-attendance">
  <img alt="platform" src="https://img.shields.io/badge/platform-GitHub%20Actions%20%7C%20Cloudflare%20Workers-blueviolet">
  <img alt="typescript" src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white">
  <img alt="node" src="https://img.shields.io/badge/Node-%E2%89%A5%2022-339933?logo=nodedotjs&logoColor=white">
  <img alt="games" src="https://img.shields.io/badge/%E6%98%8E%E6%97%A5%E6%96%B9%E8%88%9F%20%7C%20%E7%BB%88%E6%9C%AB%E5%9C%B0-%E5%8F%8C%E6%B8%B8%E6%88%8F%E7%AD%BE%E5%88%B0-success">
  <img alt="commit" src="https://img.shields.io/github/commit-activity/m/yu-echo/skland-daily-attendance">
  <img alt="stars" src="https://img.shields.io/github/stars/yu-echo/skland-daily-attendance?style=social">
</div>

---

用 **GitHub Actions** 每天自动完成森空岛签到，**同时支持明日方舟与明日方舟：终末地**，结果推送到微信。

账号绑定了哪些游戏就签哪些，不需要额外配置。核心代码跨运行时（基于 [Web Cryptography](https://caniuse.com/cryptography)），
可在 Node.js / Cloudflare Workers / 浏览器中运行。

这是 [AEtherside/skland-daily-attendance](https://github.com/AEtherside/skland-daily-attendance) 的 fork，
在上游基础上补齐了终末地支持、推送来源标识与日志脱敏。

✨ 如果这个项目帮到你，欢迎在右上角点亮 Star ✨

---

## 功能介绍

### 🌿 日常签到

- 🎮 **同时签到多个游戏**：明日方舟、明日方舟：终末地，自动识别账号绑定了哪些
- 👥 支持多账号，`SKLAND_TOKEN` 用半角逗号分隔
- 🔁 每个角色独立重试，单个失败不影响其它角色
- 😴 幂等：先查今日状态，已签到就直接跳过，不重复调用

### 📱 结果推送

- 📊 按游戏分组汇报，一眼看出哪个游戏签了什么、拿到了什么
- 🎁 奖励道具名称与数量逐条列出
- ⚠️ 运行失败时尾部附加提示行

### 🛡️ 安全

- 🔒 Token 只存 GitHub 加密 Secret，**不在代码、不在 git 历史、不在推送正文**
- 🧹 推送地址本身就是凭据（MessagePusher `/push/<token>` 等），
  错误日志会主动抹掉 URL 的 path，不会把凭据打进日志
- 🔐 凭证状态文件只写 SHA-256 短指纹，不落地 Token 明文

---

## 效果预览

```
明日方舟 官服「博士」 今天已经签到过了
明日方舟：终末地 China「管理员」 签到成功，获得了「折金票」2000个
成功签到1个角色（明日方舟：终末地 1）

----------------------
来源：GitHub Actions · attendance
运行记录：https://github.com/yu-echo/skland-daily-attendance/actions/runs/123456
Token 认证日期：2026-09-18
```

- **来源**自动识别：Actions 里显示 `GitHub Actions` 并附运行记录直达链接；
  本机直接运行显示 `本地运行`。
- **Token 认证日期**：`SKLAND_TOKEN` 是鹰角通行证的不透明凭据，本身不含签发时间，
  所以取该凭证**首次在本流水线认证成功**的日期，存在 `.skland-state.json` 里，
  由 `actions/cache` 跨运行保留。若将来 Token 换成 JWT，会自动改读真实的 `iat` / `exp`；
  读不出时不会伪造这一行。

---

## 使用说明

### 1. 获取 Token

登录 [森空岛](https://www.skland.com/) 后打开 <https://web-api.skland.com/account/info/hg>，
页面会返回一段 JSON，复制 `data.content` 的完整值。

> ⚠️ 这串 Token 等同于你的账号登录凭证，泄露等于账号被拿走。
> 不要在群里、截图里、issue 里发它。

### 2. 配置 Secrets

`Settings → Secrets and variables → Actions → New repository secret`：

| Secret | 必填 | 说明 |
| --- | --- | --- |
| `SKLAND_TOKEN` | ✅ | 上一步的 Token。多账号用**半角逗号**分隔：`token1,token2` |
| `MESSAGE_PUSHER_URL` | ⭕ | MessagePusher 的完整 Webhook 地址 |
| `SERVERCHAN_SENDKEY` | ⭕ | ServerChan 的 SendKey |
| `BARK_URL` | ⭕ | Bark 地址，形如 `https://api.day.app/<key>/` |

三个推送渠道可任选，配了哪个就走哪个；都不配则只写日志。

### 3. 跑一次

`Actions → attendance → Run workflow`。

> GitHub 的定时任务需要先手动触发一次才会激活。

### 4. 定时规则

```
cron: '0 16 * * *'    # UTC
```

即**北京时间每天 00:00**。

> 仓库里还有 `auto_push.yml`，每月 1 日和 15 日自动提交一次空 commit——
> GitHub 会在仓库 60 天无活动时停用定时任务，这个步骤用来防止它被停掉。

---

## 支持的游戏

| 游戏 | `appCode` | `gameId` | 签到接口 |
| --- | --- | --- | --- |
| 明日方舟 | `arknights` | 1（官服）/ 2（B 服） | `POST /api/v1/game/attendance` |
| 明日方舟：终末地 | `endfield` | 3 | `POST /api/v1/game/endfield/attendance` |

**这两个游戏是完全不同的链路，不能靠换参数复用**：

- **明日方舟**：角色用 `uid` 标识，`gameId` 传渠道号，签到参数放 body。
- **终末地**：一个账号下可能有**多个区服角色，每个都要单独签**；角色信息通过
  `sk-game-role: {gameId}_{roleId}_{serverId}` **请求头**传递，body 为空。
- 终末地的签到状态没有 `records` 列表，用 `hasToday` 布尔值判断。
- 终末地的奖励 `awardIds` 只有 id，名称和数量要去 `resourceInfoMap` 里查。

绑定接口 `/api/v1/game/player/binding` 一次返回账号下所有游戏的角色，
脚本会自动筛出可签到的游戏逐个处理，不需要额外配置。

---

## 从零添加一个游戏

1. 在 `packages/core/src/games.ts` 的 `GAME_REGISTRY` 里加一条记录
2. 按需扩展 `expandBindings()` 的摊平逻辑（是否需要按角色展开）
3. 其余环节——筛选、分组、输出、重试、推送——会自动适配

---

## 常见问题

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 只出现明日方舟，没有终末地 | 该账号没绑定终末地，或摊平逻辑没生效 | 看日志里角色列表展开的结果 |
| 终末地报 403 / 404 | 走错端点 | 确认用的是 `/api/v1/game/endfield/attendance` |
| 终末地报参数缺失 | 角色信息没放请求头 | 需要 `sk-game-role: {gameId}_{roleId}_{serverId}` |
| 「今天已经签到过了」 | 状态查询已有今日记录 | **正常结果**，不是失败 |
| 奖励显示「未知奖励」 | 终末地奖励 id 查不到 | 用 `awardIds[].id` 反查 `resourceInfoMap` |
| 日志里 `Path Validation Error` | 状态文件路径与 cache path 不一致 | `pnpm -C` 会切工作目录，`SKLAND_STATE_FILE` 要用 `${{ github.workspace }}` 绝对路径 |

> 💡 排查时**不要只看 run 是绿的**：漏签一个游戏是绿的，缓存没存上是绿的，
> 认证日期退化成「今天」也是绿的。要看日志。

### 本地运行

```bash
pnpm install
SKLAND_TOKEN=你的token \
MESSAGE_PUSHER_URL=你的webhook \
pnpm -C ./apps/node start
```

本机运行不需要配置 `SKLAND_STATE_FILE`，状态文件会落在当前目录。

---

## 安全说明

### Token 存在哪里

`SKLAND_TOKEN` 只存在于 GitHub 的加密 Secret，**不在代码、不在 git 历史、不在推送正文**，
Actions 日志里会自动打码成 `***`。

### 仓库设为公开会暴露什么

公开仓库的 Actions 日志**任何登录 GitHub 的账号都能查看**（未登录看不到：
日志接口返回 403，网页日志区提示 `Sign in to view`）。日志里出现的是账号昵称、角色名、
签到结果与获奖道具——**不是 Token**，但也算隐私。

介意就把仓库设为 private：Free 套餐私有仓库每月有 2000 分钟额度，
本项目一天一次、单次 1~2 分钟，一个月约 30~60 分钟，够用。

### 主动脱敏

推送地址本身就是凭据（`https://msgpusher.com/push/<token>`、`https://api.day.app/<key>/`、
`https://sctapi.ftqq.com/<sendkey>.send`），而 ofetch 抛出的错误消息里**带完整请求 URL**。
直接 `console.error(error)` 会把凭据写进日志。

`packages/notification/src/redact.ts` 会在打印前抹掉 URL 的 path 与 query，日志里只留主机名：

```
[MessagePusher] Error: [POST] "https://msgpusher.com/***": 401 Unauthorized
```

GitHub 按 Secret 值自动打码是最后一道防线，不该依赖它——URL 一旦被编码、截断，
或日志被转发到别处，打码就失效了。

---

## 其他部署方式

- [apps/node](./apps/node/README.md) —— 本仓库 GitHub Actions 用的就是这套
- [apps/cloudflare](./apps/cloudflare/README.md) —— Cloudflare Workers 版本（**目前仅支持明日方舟**）

---

## 鸣谢

本项目由 **[AEtherside/skland-daily-attendance](https://github.com/AEtherside/skland-daily-attendance)** 上游驱动，
核心 API 封装来自 **[skland-kit](https://www.npmjs.com/package/skland-kit)**。

相关项目：
- [罗德岛远程指挥部](https://github.com/enpitsuLin/rhodes-headquarters) —— 浏览器扩展，用于监控森空岛信息

---

## License

[MIT](./LICENSE)

<p align="center">
  <sub>本项目仅供学习交流，请勿用于商业用途</sub>
</p>
