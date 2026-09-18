import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import process from 'node:process'

/** 状态文件路径。延迟读取，便于测试时通过环境变量指向临时目录 */
function stateFile(): string {
  return process.env.SKLAND_STATE_FILE || '.skland-state.json'
}

interface State {
  /** 凭证指纹 -> 首次认证日期（Asia/Shanghai, YYYY-MM-DD） */
  credentials: Record<string, string>
}

const shanghaiDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

function formatDate(input: Date | number): string {
  return shanghaiDate.format(typeof input === 'number' ? new Date(input * 1000) : input)
}

function today(): string {
  return formatDate(new Date())
}

/**
 * 凭证指纹。只存不可逆短哈希，避免把 token 片段写进状态文件。
 */
export function fingerprint(token: string): string {
  return createHash('sha256').update(token).digest('hex').slice(0, 12)
}

/**
 * 尝试按 JWT 解析。SKLAND_TOKEN 目前解析不出来，
 * 但万一日后换成 JWT，这里能直接读到真实的 iat / exp，无需改代码。
 */
export function decodeJwtClaims(token: string): Record<string, unknown> | null {
  const parts = token.split('.')
  if (parts.length !== 3)
    return null
  try {
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4)
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf-8'))
  }
  catch {
    return null
  }
}

function loadState(): State {
  try {
    const file = stateFile()
    if (existsSync(file)) {
      const parsed = JSON.parse(readFileSync(file, 'utf-8'))
      if (parsed && typeof parsed === 'object' && parsed.credentials)
        return parsed as State
    }
  }
  catch {
    // 状态文件损坏就当没有，不影响签到本身
  }
  return { credentials: {} }
}

function saveState(state: State): void {
  try {
    writeFileSync(stateFile(), JSON.stringify(state, null, 2))
  }
  catch {
    // 只读环境下放弃持久化，下次运行会重新记录
  }
}

/**
 * 取每个凭证的认证日期：能解析出 JWT 就用真实签发日，否则用首次认证日期。
 */
export function resolveCredentialDates(tokens: string[]): string[] {
  const state = loadState()
  let dirty = false

  const dates = tokens.map((token) => {
    const claims = decodeJwtClaims(token)
    if (typeof claims?.iat === 'number')
      return formatDate(claims.iat)

    const key = fingerprint(token)
    if (!state.credentials[key]) {
      state.credentials[key] = today()
      dirty = true
    }
    return state.credentials[key]
  })

  if (dirty)
    saveState(state)

  return dates
}

/**
 * 推送尾部：标明来源与 Token 认证日期。
 *
 * `SKLAND_TOKEN` 是鹰角通行证的不透明凭据，本身不含签发时间，
 * 所以「认证日期」取该凭证首次在本流水线认证成功的日期，需跨运行持久化。
 * 工作流用 `actions/cache` 保留状态文件，本地运行则落在当前目录。
 */
export function buildFooter(tokens: string[], isSuccess = true): string {
  const lines: string[] = []

  if (process.env.GITHUB_ACTIONS === 'true') {
    const workflow = process.env.GITHUB_WORKFLOW
    lines.push(`来源：GitHub Actions${workflow ? ` · ${workflow}` : ''}`)

    const repo = process.env.GITHUB_REPOSITORY
    const runId = process.env.GITHUB_RUN_ID
    if (repo && runId)
      lines.push(`运行记录：${process.env.GITHUB_SERVER_URL || 'https://github.com'}/${repo}/actions/runs/${runId}`)
  }
  else {
    lines.push('来源：本地运行')
  }

  if (tokens.length > 0) {
    const dates = [...new Set(resolveCredentialDates(tokens))]
    lines.push(`Token 认证日期：${dates.join(' / ')}`)
  }

  // 仅当能读出 JWT 过期时间时才提示，避免给出无效信息
  const expiry = tokens
    .map(t => decodeJwtClaims(t)?.exp)
    .find(exp => typeof exp === 'number')
  if (typeof expiry === 'number') {
    const days = Math.floor((expiry - Date.now() / 1000) / 86400)
    lines.push(`Token 有效期至 ${formatDate(expiry)}（剩 ${days} 天）`)
  }

  if (!isSuccess)
    lines.push('本次运行存在失败项，请检查运行记录')

  return lines.join('\n')
}

export const FOOTER_SEPARATOR = '-'.repeat(22)
