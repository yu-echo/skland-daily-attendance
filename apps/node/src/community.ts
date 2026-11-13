import type { GameZone } from '@skland-x/core'
import process from 'node:process'
import { setTimeout } from 'node:timers/promises'
import {
  checkinZone,
  getCheckinStatus,
  likePost,
  listGame,
  listPosts,
  POST_CATE_KIND,
  shareZone,
  viewPost,
} from '@skland-x/core'

/**
 * 森空岛社区每日任务。
 *
 * 与 `attendance.ts` 的游戏内签到是两回事：
 * - 游戏内签到：`/api/v1/game/attendance`，领游戏奖励，每个角色一次
 * - 社区每日任务：版区检票 + 浏览 + 点赞 + 分享，拿社区经验，**每个版区分别算**
 *
 * 配额（服务端每日重置）：检票 1、浏览 5、点赞 10、分享 1。
 * 这里所有配额都可以用环境变量改，但改大没有意义——服务端不认超出的部分。
 */

export type CommunityAction = 'checkin' | 'view' | 'like' | 'share'

export const ALL_COMMUNITY_ACTIONS: CommunityAction[] = ['checkin', 'view', 'like', 'share']

/**
 * 默认动作：检票 / 浏览 / 点赞。
 *
 * 分享默认不开——它会在版区留下一条公开的分享记录，属于「看得见」的动作，
 * 要用设 `SKLAND_COMMUNITY_ACTIONS=all` 或显式加 `share`。
 */
export const DEFAULT_COMMUNITY_ACTIONS: CommunityAction[] = ['checkin', 'view', 'like']

export interface CommunityOptions {
  actions: Set<CommunityAction>
  /** 每个版区浏览几篇 */
  viewCount: number
  /** 每个版区点赞几篇 */
  likeCount: number
  /** 每个版区分享几次 */
  shareCount: number
  /** 只处理这些 gameId；空集合表示全部版区 */
  zoneIds: Set<number>
  /** 两次写操作之间的间隔（毫秒） */
  interval: number
}

/** 帖子流最多翻几页。一页 10 条，三页足够凑满 5 浏览 + 10 点赞 */
const MAX_PAGES = 3

/** 服务端提示「今天已经做过了」的文案特征 */
const ALREADY_HINTS = ['重复签到', '已签到', '已检票', '已经签到', 'already']

/** 解析动作列表；`all` / `*` 表示全部，`off` / `none` 表示全不做 */
export function parseActions(raw: string | undefined): Set<CommunityAction> {
  const text = (raw ?? '').trim().toLowerCase()
  if (!text)
    return new Set(DEFAULT_COMMUNITY_ACTIONS)
  if (text === 'all' || text === '*')
    return new Set(ALL_COMMUNITY_ACTIONS)
  if (text === '0' || text === 'off' || text === 'none' || text === 'false')
    return new Set()

  const picked = text.split(/[,;，；\s]+/).filter(Boolean)
  return new Set(
    picked.filter((item): item is CommunityAction =>
      (ALL_COMMUNITY_ACTIONS as string[]).includes(item),
    ),
  )
}

/** 读一个非负整数环境变量，非法值回落到默认值，超大值截断到上限 */
function readCount(name: string, fallback: number, max: number): number {
  const raw = process.env[name]
  if (!raw)
    return fallback
  const value = Number.parseInt(raw, 10)
  if (!Number.isFinite(value) || value < 0)
    return fallback
  return Math.min(value, max)
}

/**
 * 从环境变量组装配置。返回 `null` 表示不跑社区任务。
 *
 * | 变量 | 默认 | 说明 |
 * | --- | --- | --- |
 * | `SKLAND_COMMUNITY` | 开 | `off` / `0` 关闭整个社区任务 |
 * | `SKLAND_COMMUNITY_ACTIONS` | `checkin,view,like` | 动作组合，`all` 含分享 |
 * | `SKLAND_COMMUNITY_VIEW` | 5 | 每版区浏览数 |
 * | `SKLAND_COMMUNITY_LIKE` | 10 | 每版区点赞数 |
 * | `SKLAND_COMMUNITY_SHARE` | 1 | 每版区分享数 |
 * | `SKLAND_COMMUNITY_ZONES` | 全部 | 只做这些 gameId，逗号分隔 |
 * | `SKLAND_COMMUNITY_INTERVAL` | 800 | 写操作间隔（毫秒） |
 */
export function communityOptionsFromEnv(): CommunityOptions | null {
  const flag = (process.env.SKLAND_COMMUNITY ?? '').trim().toLowerCase()
  if (['0', 'off', 'no', 'false', 'none'].includes(flag))
    return null

  const actions = parseActions(process.env.SKLAND_COMMUNITY_ACTIONS)
  if (actions.size === 0)
    return null

  const zoneIds = new Set(
    (process.env.SKLAND_COMMUNITY_ZONES ?? '')
      .split(/[,;，；\s]+/)
      .map(item => Number.parseInt(item, 10))
      .filter(id => Number.isInteger(id) && id > 0),
  )

  return {
    actions,
    viewCount: readCount('SKLAND_COMMUNITY_VIEW', 5, 50),
    likeCount: readCount('SKLAND_COMMUNITY_LIKE', 10, 50),
    shareCount: readCount('SKLAND_COMMUNITY_SHARE', 1, 10),
    zoneIds,
    interval: readCount('SKLAND_COMMUNITY_INTERVAL', 800, 10000),
  }
}

/** 文案里是否包含「今天已经做过」的提示 */
export function isAlreadyDone(message: string | undefined | null): boolean {
  const text = (message ?? '').toLowerCase()
  if (!text)
    return false
  return ALREADY_HINTS.some(hint => text.includes(hint.toLowerCase()))
}

/** 把 ofetch 的异常压成一行可读文本 */
function errorText(error: unknown): string {
  const err = error as any
  const status = err?.response?.status
  const data = err?.response?._data ?? err?.data
  const message = data?.message ?? data?.msg ?? err?.message
  const head = typeof status === 'number' ? `HTTP ${status}` : ''
  const tail = typeof message === 'string' ? message : ''
  return [head, tail].filter(Boolean).join(' ') || '未知错误'
}

async function pause(interval: number) {
  if (interval > 0)
    await setTimeout(interval)
}

type Log = (message: string, error?: boolean) => void

/** 检票。返回给推送用的一句话 */
async function doCheckin(
  cred: string,
  token: string,
  gameId: number,
  alreadyChecked: boolean,
): Promise<string> {
  if (alreadyChecked)
    return '今日已检'

  try {
    const data = await checkinZone(cred, token, gameId)
    if (data.code !== 0) {
      if (isAlreadyDone(data.message))
        return '今日已检'
      return `失败（${data.message || `code ${data.code}`}）`
    }
    return '完成'
  }
  catch (error) {
    const text = errorText(error)
    // 已检票时服务端可能直接回 403，与「今天签过了」等价
    if (isAlreadyDone(text))
      return '今日已检'
    return `失败（${text}）`
  }
}

/** 分享。与具体帖子无关，每个版区单独一次 */
async function doShare(
  cred: string,
  token: string,
  gameId: number,
  options: CommunityOptions,
  notes: string[],
): Promise<number> {
  let done = 0
  for (let i = 0; i < options.shareCount; i++) {
    try {
      const data = await shareZone(cred, token, gameId)
      if (data.code !== 0) {
        notes.push(`分享失败（${data.message || `code ${data.code}`}）`)
        break
      }
      done++
    }
    catch (error) {
      notes.push(`分享失败（${errorText(error)}）`)
      break
    }
    await pause(options.interval)
  }
  return done
}

interface BrowseCounts {
  view: number
  like: number
  share: number
}

/**
 * 逛一个版区：按配额浏览、点赞。
 *
 * 单个动作失败只记一条提示，不中断整个版区 —— 社区任务失败不该让签到主流程判红。
 */
async function browseZone(
  cred: string,
  token: string,
  zone: GameZone,
  cateId: number,
  options: CommunityOptions,
  notes: string[],
): Promise<BrowseCounts> {
  const counts: BrowseCounts = { view: 0, like: 0, share: 0 }

  const finished = () =>
    (!options.actions.has('view') || counts.view >= options.viewCount)
    && (!options.actions.has('like') || counts.like >= options.likeCount)

  let pageToken = ''
  for (let page = 0; page < MAX_PAGES; page++) {
    if (finished())
      break

    let posts
    try {
      const data = await listPosts(cred, token, {
        gameId: zone.game.gameId,
        cateId,
        pageToken,
      })
      posts = data.list ?? []
      pageToken = data.pageToken ?? ''
      if (!posts.length || !data.hasMore)
        pageToken = ''
    }
    catch (error) {
      notes.push(`取帖子失败（${errorText(error)}）`)
      break
    }

    for (const post of posts) {
      if (finished())
        break

      const postId = post.item?.id
      if (!postId)
        continue

      if (options.actions.has('view') && counts.view < options.viewCount) {
        try {
          await viewPost(cred, token, postId)
          counts.view++
        }
        catch (error) {
          notes.push(`浏览失败（${errorText(error)}）`)
        }
        await pause(options.interval)
      }

      // 已经点过赞的不重复点：服务端会报重复，还显得像在刷
      if (options.actions.has('like') && counts.like < options.likeCount && !post.itemRel?.like) {
        if (/^\d+$/.test(postId)) {
          try {
            const data = await likePost(cred, token, postId)
            if (data.code === 0)
              counts.like++
            else
              notes.push(`点赞失败（${data.message || `code ${data.code}`}）`)
          }
          catch (error) {
            notes.push(`点赞失败（${errorText(error)}）`)
          }
          await pause(options.interval)
        }
      }
    }

    if (!pageToken)
      break
  }

  return counts
}

/**
 * 跑完一个账号的社区每日任务。
 *
 * @param cred 森空岛 cred
 * @param token 森空岛签名 token（注意不是鹰角通行证那个 token）
 * @param options 动作与配额
 * @param log 输出回调，签到那边用的是同一个 logger，好让结果并进同一条推送
 */
export async function runCommunityTasks(
  cred: string,
  token: string,
  options: CommunityOptions,
  log: Log,
): Promise<void> {
  let zones: GameZone[]
  let checkedMap: Map<number, boolean>

  try {
    const game = await listGame(cred, token)
    zones = game.list ?? []
  }
  catch (error) {
    log(`森空岛社区：获取版区列表失败（${errorText(error)}），本次跳过`)
    return
  }

  const todo = zones.filter(zone => options.zoneIds.size === 0 || options.zoneIds.has(zone.game.gameId))
  if (!todo.length) {
    log('森空岛社区：没有可处理的版区，本次跳过')
    return
  }

  try {
    const status = await getCheckinStatus(cred, token)
    checkedMap = new Map((status.list ?? []).map(item => [item.gameId, item.checked === 1]))
  }
  catch (error) {
    // 状态查不到不致命：检票接口本身会挡住重复提交
    log(`森空岛社区：查询检票状态失败（${errorText(error)}），按「今天还没检票」继续`)
    checkedMap = new Map()
  }

  log('## 森空岛社区每日任务')

  for (const zone of todo) {
    const parts: string[] = []
    const notes: string[] = []

    if (options.actions.has('checkin')) {
      parts.push(`检票 ${await doCheckin(cred, token, zone.game.gameId, checkedMap.get(zone.game.gameId) === true)}`)
      await pause(options.interval)
    }

    // 浏览 / 点赞要从「综合讨论区」取帖子；没有这个分类的版区只能检票
    const cate = (zone.cates ?? []).find(item => item.kind === POST_CATE_KIND)
    const wantsBrowse = options.actions.has('view') || options.actions.has('like')
    if (cate) {
      const counts = await browseZone(cred, token, zone, cate.id, options, notes)
      if (options.actions.has('view'))
        parts.push(`浏览 ${counts.view}/${options.viewCount}`)
      if (options.actions.has('like'))
        parts.push(`点赞 ${counts.like}/${options.likeCount}`)
    }
    else if (wantsBrowse) {
      notes.push('没有综合讨论区，跳过浏览/点赞')
    }

    if (options.actions.has('share')) {
      const shared = await doShare(cred, token, zone.game.gameId, options, notes)
      parts.push(`分享 ${shared}/${options.shareCount}`)
    }

    // 同一类失败会重复很多次（比如 10 次点赞全挂），去重并只留前三条，别把推送刷爆
    const uniqueNotes = [...new Set(notes)].slice(0, 3)
    const suffix = uniqueNotes.length ? `（${uniqueNotes.join('；')}）` : ''
    log(`- ${zone.game.name}：${parts.join(' · ')}${suffix}`)
  }
}
