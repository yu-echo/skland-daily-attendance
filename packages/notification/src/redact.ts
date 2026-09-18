/**
 * 日志脱敏工具。
 *
 * 推送地址本身就是凭据：MessagePusher 用 `https://<host>/push/<token>`、
 * Bark 用 `https://api.day.app/<key>/`、ServerChan 用 `https://sctapi.ftqq.com/<sendkey>.send`。
 * 而 ofetch 抛出的错误消息里**带完整请求 URL**（形如 `[POST] "https://...": 401 Unauthorized`），
 * 直接 `console.error(error)` 就会把凭据写进日志。
 *
 * GitHub Actions 会按 secret 值自动打码，但那是最后一道防线：
 * 仓库公开时日志任何人可读，一旦 URL 被编码、截断或转发就失效。所以在这里主动抹掉。
 */

/** 只保留协议与主机名，其余一律替换为 *** */
export function redactUrl(value: string): string {
  try {
    const url = new URL(value)
    return `${url.origin}/***`
  }
  catch {
    return '<invalid-url>'
  }
}

/**
 * 生成可安全打印的错误消息：把消息里出现的指定 URL、
 * 以及任意其它 http(s) 链接的 path/query 全部抹掉。
 */
export function safeErrorMessage(error: unknown, url?: string): string {
  let message = error instanceof Error ? error.message : String(error)

  if (url)
    message = message.split(url).join(redactUrl(url))

  // 兜底：处理消息里出现的任何其它链接（含 ofetch 自己拼的那份）
  return message.replace(/https?:\/\/[^\s"']+/g, match => redactUrl(match))
}
