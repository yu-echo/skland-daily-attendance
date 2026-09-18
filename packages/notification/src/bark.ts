import { ofetch } from 'ofetch'
import { safeErrorMessage } from './redact'

export async function bark(url: string, title: string, content: string) {
  if (typeof url !== 'string' || !url.startsWith('https://')) {
    console.error('Wrong type for Bark URL.')
    return
  }

  const payload = {
    title,
    body: content,
    group: 'Skland',
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
    // Bark 地址形如 https://api.day.app/<key>/，path 就是凭据，不能整体打进日志
    console.error(`[Bark] Error: ${safeErrorMessage(error, url)}`)
  }
}
