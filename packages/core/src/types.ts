export interface SklandResponse<T> {
  code: number
  message: string
  data: T
}

export interface AuthResponse {
  status: number
  type: string
  msg: string
  data?: { code: string, uid: string }
}

export type CredResponse = SklandResponse<{ cred: string, userId: string, token: string }>

/**
 * 终末地的「区服角色」。明日方舟没有这个概念，只有 uid。
 * 同一账号在终末地可能有多个 role，每个都要单独签到。
 */
export interface BindingRole {
  serverId: string
  serverType: string
  serverName: string
  roleId: string
  nickname: string
  level: number
  isDefault: boolean
  isBanned: boolean
}

export interface BindingUserItem {
  uid: string
  isOfficial: boolean
  isDefault: boolean
  channelMasterId: string
  channelName: string
  nickName: string
  isDelete: boolean
  /** 游戏名，绑定接口返回，例如「明日方舟：终末地」 */
  gameName?: string
  /** 游戏 id：1 = 明日方舟，3 = 终末地 */
  gameId?: number
  /** 终末地的区服角色列表；明日方舟无此字段 */
  roles?: BindingRole[]
  /** 终末地的默认区服角色；明日方舟无此字段 */
  defaultRole?: BindingRole | null
}

export interface BindingUser {
  appCode: string
  appName: string
  bindingList: BindingUserItem[]
  defaultUid: string
}

export type BindingResponse = SklandResponse<{
  list: BindingUser[]
}>

export type GetAttendanceResponse = SklandResponse<{
  currentTs: string
  calendar: {
    resourceId: string
    type: string
    count: number
    available: boolean
    done: boolean
  }[]
  records: {
    resourceId: string
    type: string
    count: number
    ts: string
  }[]
  resourceInfoMap: {
    [key: string]: {
      id: string
      name: string
      type: string
    }
  }
}>

export type AttendanceResponse = SklandResponse<{
  ts: number
  awards: {
    resource: {
      id: string
      name: string
      type: string
    }
    count: number
  }[]
}>

/** 终末地的签到状态：没有 records，改用 hasToday 判断 */
export type EndfieldAttendanceStatus = SklandResponse<{
  currentTs: string
  calendar: {
    available: boolean
    awardId: string
    done: boolean
  }[]
  first: {
    available: boolean
    awardId: string
    done: boolean
  }[]
  hasToday: boolean
  resourceInfoMap: Record<string, { count: number, icon: string, id: string, name: string }>
}>

/** 终末地的签到奖励：awardIds 只是 id 列表，名称/数量要去 resourceInfoMap 里查 */
export type EndfieldAttendanceResponse = SklandResponse<{
  awardIds: { id: string, type: number }[]
  resourceInfoMap: Record<string, { count: number, icon: string, id: string, name: string }>
  tomorrowAwardIds: { id: string, type: number }[]
  ts: string
}>

/** 明日方舟签到查询条件：uid + 渠道（1 官服 / 2 B 服） */
export interface ArknightsAttendanceQuery {
  uid: string
  gameId: string | number
}

/** 终末地签到查询条件：gameId(3) + 区服 role */
export interface EndfieldAttendanceQuery {
  gameId: string | number
  roleId: string
  serverId: string
}

export type AttendanceQuery = ArknightsAttendanceQuery | EndfieldAttendanceQuery

/** 传了 roleId/serverId 就走终末地分支 */
export function isEndfieldQuery(q: AttendanceQuery): q is EndfieldAttendanceQuery {
  return 'roleId' in q && 'serverId' in q
}
