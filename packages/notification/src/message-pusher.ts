import { ofetch } from 'ofetch'
import { safeErrorMessage } from './redact'

export async function messagePusher(url: string, title: string, content: string) {
  if (typeof url !== 'string' || !url.startsWith('https://')) {
    console.error('Wrong type for MessagePusher URL.')
    return
  }

  const payload = {
    title,
    content,
    description: content,
  }
  try {
    const data = await ofetch(
      url,
      {
        method: 'POST',
        body: payload,
      },
    )
    console.debug(data)
  }
  catch (error) {
    // 不能直接打印 error：ofetch 的错误消息带完整请求 URL，而该 URL 的 path 就是凭据
    console.error(`[MessagePusher] Error: ${safeErrorMessage(error, url)}`)
  }
}
