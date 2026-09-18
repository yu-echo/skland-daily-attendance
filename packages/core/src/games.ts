import type {
  AttendanceQuery,
  AttendanceResponse,
  BindingUser,
  BindingUserItem,
  EndfieldAttendanceResponse,
  EndfieldAttendanceStatus,
  GetAttendanceResponse,
} from './types'

/**
 * 支持签到的游戏。
 *
 * 新增游戏时在 `GAME_REGISTRY` 里加一条即可，其余逻辑会自动适配：
 * - 绑定接口返回的 `appCode` 用于筛选
 * - `expandBindings()` 负责把绑定数据摊平成「一次签到 = 一个目标」
 */
export const GAME_REGISTRY = {
  arknights: {
    appCode: 'arknights',
    gameId: 1,
    name: '明日方舟',
  },
  endfield: {
    appCode: 'endfield',
    gameId: 3,
    name: '明日方舟：终末地',
  },
} as const

export type SupportedAppCode = keyof typeof GAME_REGISTRY

export const SUPPORTED_APP_CODES = Object.keys(GAME_REGISTRY) as SupportedAppCode[]

export function isSupportedApp(appCode: string): appCode is SupportedAppCode {
  return appCode in GAME_REGISTRY
}

/** 一个待签到的目标。`query` 为 null 时表示该角色不可签到（例如终末地没有区服角色） */
export interface AttendanceTarget {
  appCode: SupportedAppCode
  gameName: string
  /** 用于日志与推送展示的角色标签 */
  label: string
  query: AttendanceQuery | null
  skipReason?: string
}

/** 明日方舟的渠道：channelMasterId 1 = 官服，2 = B 服 */
function arknightsChannelLabel(channelMasterId: string): string {
  return Number(channelMasterId) - 1 ? 'B 服' : '官服'
}

/**
 * 把绑定接口返回的 list 摊平成待签到目标列表。
 *
 * - 明日方舟：一个绑定项对应一次签到
 * - 终末地：一个绑定项下可能有多个区服角色，每个角色都要单独签到
 */
export function expandBindings(list: BindingUser[]): AttendanceTarget[] {
  const targets: AttendanceTarget[] = []

  for (const binding of list) {
    const appCode = binding.appCode
    if (!isSupportedApp(appCode))
      continue

    const gameName: string = GAME_REGISTRY[appCode].name

    if (appCode === 'arknights') {
      for (const player of binding.bindingList)
        targets.push(buildArknightsTarget(player, gameName))
      continue
    }

    for (const player of binding.bindingList)
      targets.push(...buildEndfieldTargets(player, gameName))
  }

  return targets
}

function buildArknightsTarget(player: BindingUserItem, gameName: string): AttendanceTarget {
  const channel = arknightsChannelLabel(player.channelMasterId)
  const name = player.nickName || player.uid
  return {
    appCode: 'arknights',
    gameName,
    label: `${gameName} ${channel}「${name}」`,
    // 保持与改造前一致：明日方舟用渠道 id 作为 gameId
    query: { uid: player.uid, gameId: player.channelMasterId },
  }
}

function buildEndfieldTargets(
  player: BindingUserItem,
  gameName: string,
): AttendanceTarget[] {
  // 优先用所有区服角色；部分账号只返回 defaultRole
  const roles = player.roles?.length
    ? player.roles
    : (player.defaultRole ? [player.defaultRole] : [])

  if (roles.length === 0) {
    return [{
      appCode: 'endfield',
      gameName,
      label: `${gameName}「${player.nickName || player.uid}」`,
      query: null,
      skipReason: '没有区服角色，跳过签到',
    }]
  }

  return roles.map(role => ({
    appCode: 'endfield' as const,
    gameName,
    label: `${gameName} ${role.serverName}「${role.nickname || role.roleId}」`,
    query: {
      // 绑定接口没给 gameId 时兜底用注册表里的值
      gameId: player.gameId ?? GAME_REGISTRY.endfield.gameId,
      roleId: role.roleId,
      serverId: role.serverId,
    },
  }))
}

/**
 * 判断今天是否已签到。
 *
 * 明日方舟看 `records`，终末地看 `hasToday`。
 * 日期比较固定用 Asia/Shanghai，避免在 UTC 的 CI runner 上算错一天。
 */
export function isAlreadyAttended(
  status: GetAttendanceResponse | EndfieldAttendanceStatus | unknown,
): boolean {
  const data = (status as { data?: unknown })?.data
  if (!data || typeof data !== 'object')
    return false

  const record = data as Record<string, unknown>

  if (typeof record.hasToday === 'boolean')
    return record.hasToday

  if (Array.isArray(record.records)) {
    const today = formatShanghaiDate(new Date())
    return (record.records as { ts: string }[]).some(
      i => formatShanghaiDate(new Date(Number(i.ts) * 1000)) === today,
    )
  }

  return false
}

const shanghaiDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

function formatShanghaiDate(date: Date): string {
  return shanghaiDateFormatter.format(date)
}

/** 明日方舟奖励：awards[].resource.name + count */
export function formatArknightsAwards(data: AttendanceResponse['data']): string {
  return data.awards.map(a => `「${a.resource.name}」${a.count}个`).join('，')
}

/** 终末地奖励：awardIds 只有 id，名称和数量要去 resourceInfoMap 里查 */
export function formatEndfieldAwards(data: EndfieldAttendanceResponse['data']): string {
  const map = data.resourceInfoMap ?? {}
  return (data.awardIds ?? []).map((a) => {
    const info = map[a.id]
    return info ? `「${info.name}」${info.count ?? 1}个` : '「未知奖励」1个'
  }).join('，')
}

export function formatAwards(
  appCode: SupportedAppCode,
  data: AttendanceResponse['data'] | EndfieldAttendanceResponse['data'],
): string {
  if (appCode === 'endfield')
    return formatEndfieldAwards(data as EndfieldAttendanceResponse['data'])
  return formatArknightsAwards(data as AttendanceResponse['data'])
}
