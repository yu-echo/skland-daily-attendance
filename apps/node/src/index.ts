import assert from 'node:assert'
import process from 'node:process'
import { doAttendanceForAccount } from './attendance'
import { communityOptionsFromEnv } from './community'

try {
  process.loadEnvFile('.env')
}
catch {
  // ignore, dotenv 基本只适用于本地开发
}

assert(typeof process.env.SKLAND_TOKEN === 'string', 'SKLAND_TOKEN 未设置')

const accounts = process.env.SKLAND_TOKEN.split(',')

const community = communityOptionsFromEnv()
if (community) {
  console.log(
    `社区每日任务：${[...community.actions].join(' / ')}`
    + `（每版区 浏览 ${community.viewCount}、点赞 ${community.likeCount}、分享 ${community.shareCount}）`,
  )
}
else {
  console.log('社区每日任务：未启用（SKLAND_COMMUNITY 关闭或动作为空）')
}

for (const [index, token] of accounts.entries()) {
  console.log(`开始处理第 ${index + 1}/${accounts.length} 个账号`)
  // eslint-disable-next-line antfu/no-top-level-await
  await doAttendanceForAccount(token, {
    // ServerChan 的 sendkey 在工作流里叫 SERVERCHAN_SENDKEY，两个名字都认
    withServerChan: process.env.SERVER_CHAN_TOKEN || process.env.SERVERCHAN_SENDKEY,
    withBark: process.env.BARK_URL,
    withMessagePusher: process.env.MESSAGE_PUSHER_URL,
  }, community)
}
