import type {
  AttendanceQuery,
  AttendanceResponse,
  BindingResponse,
  CredResponse,
  EndfieldAttendanceResponse,
  EndfieldAttendanceStatus,
  GetAttendanceResponse,
} from '../types'
import { createFetch } from 'ofetch'
import { ENDFIELD_ATTENDANCE_URL, SKLAND_ATTENDANCE_URL } from '../constant'
import { isAlreadyAttended } from '../games'
import { isEndfieldQuery } from '../types'
import { command_header, getDid, onSignatureRequest } from '../utils'

const fetch = createFetch({
  defaults: {
    baseURL: 'https://zonai.skland.com',
    onRequest: onSignatureRequest,
  },
})

/**
 * grant_code 获得森空岛用户的 token 等信息
 * @param grant_code 从 OAuth 接口获取的 grant_code
 */
export async function signIn(grant_code: string) {
  const data = await fetch<CredResponse>(
    '/web/v1/user/auth/generate_cred_by_code',
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
        'referer': 'https://www.skland.com/',
        'origin': 'https://www.skland.com',
        'dId': await getDid(),
        'platform': '3',
        'timestamp': `${Math.floor(Date.now() / 1000)}`,
        'vName': '1.0.0',
      },
      body: {
        code: grant_code,
        kind: 1,
      },
      onRequestError(ctx) {
        throw new Error(`登录获取 cred 错误:${ctx.error.message}`)
      },
    },
  )

  return data.data
}

/**
 * 通过登录凭证和森空岛用户的 token 获取角色绑定列表
 *
 * 返回的 list 里同时包含明日方舟和终末地等游戏，
 * 用 `expandBindings()` 摊平成待签到目标。
 *
 * @param cred 鹰角网络通行证账号的登录凭证
 * @param token 森空岛用户的 token
 */
export async function getBinding(cred: string, token: string) {
  const data = await fetch<BindingResponse>(
    '/api/v1/game/player/binding',
    {
      headers: { token, cred },
      onRequestError(ctx) {
        throw new Error(`获取绑定角色错误:${ctx.error.message}`)
      },
    },
  )

  return data.data
}

/**
 * 终末地把区服角色信息放在请求头里，而不是 query / body
 */
function endfieldRoleHeaders(query: AttendanceQuery) {
  if (!isEndfieldQuery(query))
    return {}
  return {
    'sk-game-role': `${query.gameId}_${query.roleId}_${query.serverId}`,
  }
}

/**
 * 查询今日签到状态
 *
 * - 明日方舟：`GET /api/v1/game/attendance?uid&gameId`
 * - 终末地：`GET /api/v1/game/endfield/attendance`，角色信息走 `sk-game-role` 头
 *
 * @param cred 鹰角网络通行证账号的登录凭证
 * @param token 森空岛用户的 token
 * @param query 签到查询条件，见 `AttendanceQuery`
 */
export async function getAttendanceStatus(
  cred: string,
  token: string,
  query: AttendanceQuery,
): Promise<GetAttendanceResponse | EndfieldAttendanceStatus> {
  if (isEndfieldQuery(query)) {
    return await fetch<EndfieldAttendanceStatus>(
      ENDFIELD_ATTENDANCE_URL,
      {
        headers: Object.assign(
          { token, cred },
          command_header,
          endfieldRoleHeaders(query),
        ),
      },
    )
  }

  return await fetch<GetAttendanceResponse>(
    SKLAND_ATTENDANCE_URL,
    {
      headers: Object.assign({ token, cred }, command_header),
      query,
    },
  )
}

/**
 * 执行每日签到
 *
 * 今天的签到记录已存在时返回 `false`（保持旧行为，调用方据此判断「今天已经签到过了」）。
 *
 * @param cred 鹰角网络通行证账号的登录凭证
 * @param token 森空岛用户的 token
 * @param query 签到查询条件，见 `AttendanceQuery`
 */
export async function attendance(
  cred: string,
  token: string,
  query: AttendanceQuery,
): Promise<false | AttendanceResponse | EndfieldAttendanceResponse> {
  const status = await getAttendanceStatus(cred, token, query)

  if (isAlreadyAttended(status))
    return false

  if (isEndfieldQuery(query)) {
    return await fetch<EndfieldAttendanceResponse>(
      ENDFIELD_ATTENDANCE_URL,
      {
        method: 'POST',
        headers: Object.assign(
          { token, cred },
          command_header,
          endfieldRoleHeaders(query),
          {
            'referer': 'https://game.skland.com/',
            'origin': 'https://game.skland.com/',
          },
        ),
      },
    )
  }

  return await fetch<AttendanceResponse>(
    SKLAND_ATTENDANCE_URL,
    {
      method: 'POST',
      headers: Object.assign({ token, cred }, command_header),
      body: query,
    },
  )
}
