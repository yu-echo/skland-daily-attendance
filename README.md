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


## 注意事项

- 本项目仅用于学习和研究目的
- 请勿频繁调用 API，以免影响账号安全

## 相关项目

- [罗德岛远程指挥部](https://github.com/enpitsuLin/rhodes-headquarters) - 浏览器扩展，用于监控森空岛信息

## License

MIT
