import type {
  ActionResponse,
  AttendanceQuery,
  AttendanceResponse,
  BindingResponse,
  CheckinResponse,
  CheckinStatusResponse,
  CredResponse,
  EndfieldAttendanceResponse,
  EndfieldAttendanceStatus,
  GameListResponse,
  GetAttendanceResponse,
  PostDetailResponse,
  PostListResponse,
  ShareResponse,
} from '../types'
import { createFetch } from 'ofetch'
import {
  ACTION_LIKE,
  COMMUNITY_TIMEOUT,
  ENDFIELD_ATTENDANCE_URL,
  SKLAND_ACTION_URL,
  SKLAND_ATTENDANCE_URL,
  SKLAND_CHECKIN_STATUS_URL,
  SKLAND_CHECKIN_URL,
  SKLAND_GAME_LIST_URL,
  SKLAND_POST_DETAIL_URL,
  SKLAND_POST_LIST_URL,
  SKLAND_SHARE_URL,
} from '../constant'
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
 *
 * 返回类型显式写成 `Record<string, string>`：否则 `{}` 分支会被推断成
 * `{ 'sk-game-role'?: undefined }`，与 ofetch 的 `HeadersInit` 冲突（历史遗留报错）。
 */
function endfieldRoleHeaders(query: AttendanceQuery): Record<string, string> {
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
            referer: 'https://game.skland.com/',
            origin: 'https://game.skland.com/',
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

// ---------------------------------------------------------------------------
// 森空岛社区每日任务
//
// 与上面「游戏内签到」是两套完全独立的接口：
// · 游戏内签到 = /api/v1/game/attendance，领游戏奖励
// · 社区每日任务 = 版区检票 + 浏览 + 点赞 + 分享，拿社区经验
// 检票每个版区每天一次；浏览 / 点赞 / 分享的配额按版区分别计算。
// ---------------------------------------------------------------------------

/** 版区列表。社区任务靠它枚举要处理哪些版区、帖子流用哪个分类 */
export async function listGame(cred: string, token: string) {
  const data = await fetch<GameListResponse>(SKLAND_GAME_LIST_URL, {
    timeout: COMMUNITY_TIMEOUT,
    headers: Object.assign({ token, cred }, command_header),
    onRequestError(ctx) {
      throw new Error(`获取版区列表错误:${ctx.error.message}`)
    },
  })

  return data.data
}

/** 各版区今日检票状态 */
export async function getCheckinStatus(cred: string, token: string) {
  const data = await fetch<CheckinStatusResponse>(SKLAND_CHECKIN_STATUS_URL, {
    timeout: COMMUNITY_TIMEOUT,
    headers: Object.assign({ token, cred }, command_header),
    onRequestError(ctx) {
      throw new Error(`查询检票状态错误:${ctx.error.message}`)
    },
  })

  return data.data
}

/**
 * 版区检票
 *
 * 已检票时服务端返回非 0 的业务码（或 403），调用方据此判断「今天已经检过了」。
 */
export async function checkinZone(cred: string, token: string, gameId: number | string) {
  return await fetch<CheckinResponse>(SKLAND_CHECKIN_URL, {
    timeout: COMMUNITY_TIMEOUT,
    method: 'POST',
    headers: Object.assign({ token, cred }, command_header),
    body: { gameId: String(gameId) },
  })
}

/** 帖子流查询条件。`pageToken` 为空表示第一页 */
export interface PostListQuery {
  gameId: number | string
  cateId: number | string
  pageToken?: string
  pageSize?: number
  sortType?: string
}

/**
 * 拉版区帖子流
 *
 * 注意 `pageToken` 为空时**不带这个参数**：签名用的 query 串与真实请求 URL 必须逐字符一致，
 * 空值序列化出来是 `pageToken`（不带等号），多带一个空参数只是徒增签名对不上的风险。
 */
export async function listPosts(cred: string, token: string, query: PostListQuery) {
  const params: Record<string, string> = {
    gameId: String(query.gameId),
    cateId: String(query.cateId),
    sortType: query.sortType ?? '4',
    pageSize: String(query.pageSize ?? 10),
  }
  if (query.pageToken)
    params.pageToken = query.pageToken

  const data = await fetch<PostListResponse>(SKLAND_POST_LIST_URL, {
    timeout: COMMUNITY_TIMEOUT,
    headers: Object.assign({ token, cred }, command_header),
    query: params,
  })

  return data.data
}

/** 浏览单个帖子：拉一次详情就算浏览过 */
export async function viewPost(cred: string, token: string, postId: string) {
  const data = await fetch<PostDetailResponse>(SKLAND_POST_DETAIL_URL, {
    timeout: COMMUNITY_TIMEOUT,
    headers: Object.assign({ token, cred }, command_header),
    query: { ids: String(postId) },
  })

  return data.data
}

/** 点赞帖子。`action` 默认 12（点赞），21 是收藏 */
export async function likePost(
  cred: string,
  token: string,
  objectId: string | number,
  action: number = ACTION_LIKE,
) {
  return await fetch<ActionResponse>(SKLAND_ACTION_URL, {
    timeout: COMMUNITY_TIMEOUT,
    method: 'POST',
    headers: Object.assign({ token, cred }, command_header),
    body: { objectId: Number(objectId), action },
  })
}

/** 版区分享（每个版区每天算一次，与具体帖子无关） */
export async function shareZone(cred: string, token: string, gameId: number | string) {
  return await fetch<ShareResponse>(SKLAND_SHARE_URL, {
    timeout: COMMUNITY_TIMEOUT,
    method: 'POST',
    headers: Object.assign({ token, cred }, command_header),
    body: { gameId: String(gameId) },
  })
}
