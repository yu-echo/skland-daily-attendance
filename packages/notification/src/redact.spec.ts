import { describe, expect, it } from 'vitest'
import { redactUrl, safeErrorMessage } from './redact'

describe('redactUrl', () => {
  it('抹掉 path，只留协议与主机名', () => {
    expect(redactUrl('https://msgpusher.com/push/abc123@qq.com')).toBe('https://msgpusher.com/***')
    expect(redactUrl('https://api.day.app/MyBarkKey123/')).toBe('https://api.day.app/***')
    expect(redactUrl('https://sctapi.ftqq.com/SCT123456.send')).toBe('https://sctapi.ftqq.com/***')
  })

  it('连 query 一起抹掉', () => {
    expect(redactUrl('https://example.com/hook?token=secret')).toBe('https://example.com/***')
  })

  it('非法 URL 不抛错', () => {
    expect(redactUrl('not a url')).toBe('<invalid-url>')
    expect(redactUrl('')).toBe('<invalid-url>')
  })
})

describe('safeErrorMessage', () => {
  it('抹掉 ofetch 错误消息里的请求 URL（真实格式）', () => {
    const url = 'https://msgpusher.com/push/abc123@qq.com'
    const error = new Error(`[POST] "${url}": 401 Unauthorized`)
    const message = safeErrorMessage(error, url)
    expect(message).not.toContain('abc123')
    expect(message).not.toContain('push/')
    expect(message).toContain('https://msgpusher.com/***')
    expect(message).toContain('401 Unauthorized')
  })

  it('即使没传 url 参数，也能兜底抹掉消息里任意链接的 path', () => {
    const error = new Error('fetch failed for https://api.day.app/SecretKey9988/')
    const message = safeErrorMessage(error)
    expect(message).not.toContain('SecretKey9988')
    expect(message).toContain('https://api.day.app/***')
  })

  it('一次抹掉多个链接', () => {
    const message = safeErrorMessage(
      new Error('a https://a.com/secret1 b https://b.com/secret2'),
    )
    expect(message).not.toContain('secret1')
    expect(message).not.toContain('secret2')
  })

  it('非 Error 输入不抛错', () => {
    expect(safeErrorMessage('plain string')).toBe('plain string')
    expect(safeErrorMessage(undefined)).toBe('undefined')
    expect(safeErrorMessage({ toString: () => 'obj' })).toContain('obj')
  })

  it('保留不含链接的原始信息，便于排查', () => {
    expect(safeErrorMessage(new Error('socket hang up'))).toBe('socket hang up')
  })
})
