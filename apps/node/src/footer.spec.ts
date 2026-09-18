import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildFooter, decodeJwtClaims, fingerprint, resolveCredentialDates } from './footer'

let dir: string
let statePath: string

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
const fakeJwt = (claims: object) => `${b64({ alg: 'RS256' })}.${b64(claims)}.sig`
const dateOf = (text: string) => text.match(/Token 认证日期：(.+)/)![1]
const shanghaiDate = (d: Date) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(d)

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'skland-footer-'))
  statePath = join(dir, 'state.json')
  process.env.SKLAND_STATE_FILE = statePath
  process.env.GITHUB_ACTIONS = 'true'
  process.env.GITHUB_WORKFLOW = 'attendance'
  process.env.GITHUB_REPOSITORY = 'yu-echo/skland-daily-attendance'
  process.env.GITHUB_RUN_ID = '35312847719'
  process.env.GITHUB_SERVER_URL = 'https://github.com'
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
  vi.unstubAllEnvs()
})

describe('fingerprint', () => {
  it('同一凭证指纹稳定，不同凭证不同，且不泄露原文', () => {
    const token = 'a'.repeat(120)
    expect(fingerprint(token)).toBe(fingerprint(token))
    expect(fingerprint(token)).not.toBe(fingerprint('b'.repeat(120)))
    expect(token).not.toContain(fingerprint(token))
    expect(fingerprint(token)).toHaveLength(12)
  })
})

describe('resolveCredentialDates', () => {
  it('首次见到的凭证记录为今天', () => {
    const dates = resolveCredentialDates(['a'.repeat(120)])
    expect(dates[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('已记录的日期被沿用，不会重取今天', () => {
    const token = 'd'.repeat(120)
    writeFileSync(statePath, JSON.stringify({ credentials: { [fingerprint(token)]: '2026-01-15' } }))
    expect(resolveCredentialDates([token])).toEqual(['2026-01-15'])
  })

  it('状态文件损坏时降级为重新记录，不抛错', () => {
    writeFileSync(statePath, 'not json at all')
    expect(resolveCredentialDates(['a'.repeat(120)])[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('状态文件里只写指纹，不写 token 明文', () => {
    const token = 'a'.repeat(120)
    resolveCredentialDates([token])
    const raw = readFileSync(statePath, 'utf-8')
    expect(raw).not.toContain('aaaa')
    expect(raw).toContain(fingerprint(token))
  })

  it('能解析 JWT 时用真实签发日，而不是首次见到的那天', () => {
    const iat = Math.floor(Date.now() / 1000) - 86400 * 30
    const expected = shanghaiDate(new Date(iat * 1000))
    expect(decodeJwtClaims(fakeJwt({ iat }))).toBeTruthy()
    expect(resolveCredentialDates([fakeJwt({ iat })])).toEqual([expected])
    // 且不应把 JWT 写进状态文件
    expect(existsSync(statePath)).toBe(false)
  })
})

describe('decodeJwtClaims', () => {
  it('非 JWT 返回 null', () => {
    expect(decodeJwtClaims('a'.repeat(120))).toBeNull()
    expect(decodeJwtClaims('a.b')).toBeNull()
  })

  it('损坏的 JWT 返回 null 而不是抛错', () => {
    expect(decodeJwtClaims('a.!!!notbase64!!!.c')).toBeNull()
  })
})

describe('buildFooter', () => {
  it('GitHub Actions 下标明来源并附运行记录直达链接', () => {
    const footer = buildFooter(['a'.repeat(120)])
    expect(footer).toContain('来源：GitHub Actions · attendance')
    expect(footer).toContain('https://github.com/yu-echo/skland-daily-attendance/actions/runs/35312847719')
  })

  it('本地运行时显示「本地运行」，不谎报 CI 来源', () => {
    vi.stubEnv('GITHUB_ACTIONS', '')
    const footer = buildFooter(['a'.repeat(120)])
    expect(footer).toContain('来源：本地运行')
    expect(footer).not.toContain('GitHub Actions')
  })

  it('日期不同的多个凭证分别展示，同日则去重', () => {
    const oldToken = 'd'.repeat(120)
    writeFileSync(statePath, JSON.stringify({ credentials: { [fingerprint(oldToken)]: '2026-01-15' } }))
    const different = buildFooter([oldToken, 'a'.repeat(120)])
    expect(dateOf(different).split(' / ')).toHaveLength(2)
    const sameDay = buildFooter(['a'.repeat(120), 'b'.repeat(120)])
    expect(dateOf(sameDay).split(' / ')).toHaveLength(1)
  })

  it('不可解析的 token 不伪造有效期', () => {
    expect(buildFooter(['a'.repeat(120)])).not.toContain('有效期')
  })

  it('JWT 凭证展示有效期且不出现 undefined', () => {
    const iat = Math.floor(Date.now() / 1000) - 86400 * 30
    const exp = Math.floor(Date.now() / 1000) + 86400 * 45
    const footer = buildFooter([fakeJwt({ iat, exp })])
    expect(footer).toContain('Token 有效期至')
    expect(footer).not.toContain('undefined')
  })

  it('失败运行时附加提示', () => {
    expect(buildFooter(['a'.repeat(120)], false)).toContain('本次运行存在失败项')
    expect(buildFooter(['a'.repeat(120)], true)).not.toContain('本次运行存在失败项')
  })

  it('无凭证时不输出认证日期行', () => {
    const footer = buildFooter([])
    expect(footer).not.toContain('Token 认证日期')
    expect(existsSync(statePath)).toBe(false)
  })
})
