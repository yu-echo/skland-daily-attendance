import { ofetch } from 'ofetch'
import { safeErrorMessage } from './redact'

const SERVER_CHAN_ENDPOINT = 'https://sctapi.ftqq.com'

export async function serverChan(sendkey: string, title: string, content: string) {
  if (typeof sendkey !== 'string') {
    console.error('Wrong type for serverChan token.')
    return
    // throw new Error("Wrong type for serverChan token.");
  }
  const payload = {
    title,
    desp: content,
  }
  // sendkey 就藏在 URL 的 path 里（/<sendkey>.send），出错时不能把 URL 打出来
  const url = `${SERVER_CHAN_ENDPOINT}/${sendkey}.send`
  try {
    const data = await ofetch<{ code: number }>(
      url,
      {
        method: 'POST',
        body: payload,
      },
    )
    if (data.code === 0) {
      console.log('[ServerChan] Send message to ServerChan successfully.')
    }
    else {
      console.log(`[ServerChan][Send Message Response] ${data}`)
    }
  }
  catch (error) {
    console.error(`[ServerChan] Error: ${safeErrorMessage(error, url)}`)
  }
}
