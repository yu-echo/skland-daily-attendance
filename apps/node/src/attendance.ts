import type { AttendanceTarget, SupportedAppCode } from '@skland-x/core'
import process from 'node:process'
import { setTimeout } from 'node:timers/promises'
import { attendance, auth, expandBindings, formatAwards, getBinding, signIn } from '@skland-x/core'
import { bark, messagePusher, serverChan } from '@skland-x/notification'

interface Options {
  /** server 酱推送功能的启用，false 或者 server 酱的 token */
  withServerChan?: false | string
  /** bark 推送功能的启用，false 或者 bark 的 URL */
  withBark?: false | string
  /** 消息推送功能的启用，false 或者 message-pusher 的 WebHook URL */
  withMessagePusher?: false | string
}

function createCombinePushMessage(options: Options) {
  const messages: string[] = []
  let hasError = false
  const logger = (message: string, error?: boolean) => {
    messages.push(message)
    console[error ? 'error' : 'log'](message)
    if (error && !hasError)
      hasError = true
  }
  const push = async () => {
    const title = `【森空岛每日签到】`
    const content = messages.join('\n\n')
    if (options.withServerChan) {
      await serverChan(options.withServerChan, title, content)
    }
    if (options.withBark) {
      await bark(options.withBark, title, content)
    }
    if (options.withMessagePusher) {
      await messagePusher(options.withMessagePusher, title, content)
    }
    // quit with error
    if (hasError)
      process.exit(1)
  }
  const add = (message: string) => {
    messages.push(message)
  }
  return [logger, push, add] as const
}

export async function doAttendanceForAccount(token: string, options: Options) {
  const { code } = await auth(token)
  const { cred, token: signToken } = await signIn(code)
  const { list } = await getBinding(cred, signToken)

  const [combineMessage, excutePushMessage, addMessage] = createCombinePushMessage(options)

  // 绑定接口一次返回所有游戏，摊平成「一次签到 = 一个目标」
  const targets = expandBindings(list)

  if (targets.length === 0) {
    combineMessage('该账号没有绑定任何支持签到的游戏角色')
    await excutePushMessage()
    return
  }

  // 按游戏分组输出，先统计再签到
  const byGame = new Map<SupportedAppCode, { name: string, targets: AttendanceTarget[] }>()
  for (const target of targets) {
    if (!byGame.has(target.appCode))
      byGame.set(target.appCode, { name: target.gameName, targets: [] })
    byGame.get(target.appCode)!.targets.push(target)
  }

  const maxRetries = Number.parseInt(process.env.MAX_RETRIES || '3', 10)
  const stats = { success: 0, alreadyAttended: 0, skipped: 0 }
  const successByGame = new Map<SupportedAppCode, number>()

  for (const [appCode, group] of byGame) {
    addMessage(`## ${group.name}`)

    for (const target of group.targets) {
      if (!target.query) {
        combineMessage(`${target.label} ${target.skipReason ?? '跳过签到'}`)
        stats.skipped++
        continue
      }

      let retries = 0
      while (retries < maxRetries) {
        try {
          const data = await attendance(cred, signToken, target.query)

          if (data === false) {
            combineMessage(`${target.label} 今天已经签到过了`)
            stats.alreadyAttended++
            break
          }

          if (data.code === 0 && data.message === 'OK') {
            const awards = formatAwards(appCode, data.data)
            combineMessage(`${target.label} 签到成功，获得了${awards}`)
            stats.success++
            successByGame.set(appCode, (successByGame.get(appCode) ?? 0) + 1)
            break
          }

          combineMessage(
            `${target.label} 签到失败，错误消息: ${data.message}\n\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``,
            true,
          )
          retries++
        }
        catch (error: any) {
          if (error.response && error.response.status === 403) {
            combineMessage(`${target.label} 今天已经签到过了`)
            stats.alreadyAttended++
            break
          }
          combineMessage(`${target.label} 签到过程中出现未知错误: ${error.message}`, true)
          console.error('发生未知错误，工作流终止。')
          retries++
          if (retries >= maxRetries)
            process.exit(1)
        }
        // 多个角色之间的延时
        await setTimeout(3000)
      }
    }
  }

  if (stats.success > 0) {
    const detail = [...successByGame]
      .map(([appCode, count]) => `${byGame.get(appCode)!.name} ${count}`)
      .join(' / ')
    combineMessage(`成功签到${stats.success}个角色（${detail}）`)
  }

  await excutePushMessage()
}
