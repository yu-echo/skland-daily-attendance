import type { BindingUser, BindingRole } from './types'
import { describe, expect, it } from 'vitest'
import { expandBindings, formatAwards, isAlreadyAttended } from './games'

function role(
  serverId: string,
  serverName: string,
  roleId: string,
  nickname: string,
  isDefault: boolean,
): BindingRole {
  return { serverId, serverType: '1', serverName, roleId, nickname, level: 60, isDefault, isBanned: false }
}

const bindingList: BindingUser[] = [
  {
    appCode: 'arknights',
    appName: '明日方舟',
    defaultUid: 'u1',
    bindingList: [
      { uid: 'u1', isOfficial: true, isDefault: true, channelMasterId: '1', channelName: '官服', nickName: '博士', isDelete: false, gameName: '明日方舟', gameId: 1 },
      { uid: 'u2', isOfficial: false, isDefault: false, channelMasterId: '2', channelName: 'B服', nickName: '小号', isDelete: false, gameName: '明日方舟', gameId: 2 },
    ],
  },
  {
    appCode: 'endfield',
    appName: '明日方舟：终末地',
    defaultUid: 'r100',
    bindingList: [
      {
        uid: 'e1',
        nickName: '管理员',
        isOfficial: true,
        isDefault: true,
        channelMasterId: '1',
        channelName: '官服',
        isDelete: false,
        gameName: '明日方舟：终末地',
        gameId: 3,
        roles: [role('1', '亚服', '100', '管A', true), role('2', '欧服', '200', '管B', false)],
        defaultRole: role('1', '亚服', '100', '管A', true),
      },
      {
        uid: 'e2',
        nickName: '没有角色',
        isOfficial: true,
        isDefault: false,
        channelMasterId: '1',
        channelName: '官服',
        isDelete: false,
        gameName: '明日方舟：终末地',
        gameId: 3,
        roles: [],
        defaultRole: null,
      },
    ],
  },
  { appCode: 'popucom', appName: '泡姆泡姆', defaultUid: 'x', bindingList: [{ uid: 'x' } as any] },
]

describe('expandBindings', () => {
  it('把明日方舟和终末地一起摊平成待签到目标', () => {
    const targets = expandBindings(bindingList)
    expect(targets).toHaveLength(5)
    expect(targets.filter(t => t.appCode === 'arknights')).toHaveLength(2)
    expect(targets.filter(t => t.appCode === 'endfield')).toHaveLength(3)
  })

  it('过滤掉不支持的游戏', () => {
    const targets = expandBindings(bindingList)
    expect(targets.some(t => t.appCode === ('popucom' as any))).toBe(false)
  })

  it('明日方舟保持 uid + 渠道号作为 gameId', () => {
    const ark = expandBindings(bindingList).filter(t => t.appCode === 'arknights')
    expect(ark[0].query).toEqual({ uid: 'u1', gameId: '1' })
    expect(ark[1].query).toEqual({ uid: 'u2', gameId: '2' })
    expect(ark[0].label).toContain('官服')
    expect(ark[1].label).toContain('B 服')
  })

  it('终末地按区服角色逐个展开，用 roleId + serverId', () => {
    const end = expandBindings(bindingList).filter(t => t.appCode === 'endfield')
    expect(end[0].query).toEqual({ gameId: 3, roleId: '100', serverId: '1' })
    expect(end[1].query).toEqual({ gameId: 3, roleId: '200', serverId: '2' })
    expect(end[0].label).toContain('亚服')
    expect(end[0].label).toContain('管A')
  })

  it('终末地没有区服角色时降级为跳过，而不是抛错', () => {
    const end = expandBindings(bindingList).filter(t => t.appCode === 'endfield')
    expect(end[2].query).toBeNull()
    expect(end[2].skipReason).toBeTruthy()
  })

  it('gameId 缺失时兜底为 3', () => {
    const noGameId: BindingUser[] = [{
      appCode: 'endfield',
      appName: '明日方舟：终末地',
      defaultUid: 'r1',
      bindingList: [{
        uid: 'e9',
        nickName: 'n',
        isOfficial: true,
        isDefault: true,
        channelMasterId: '1',
        channelName: '官服',
        isDelete: false,
        roles: [role('1', '亚服', '1', 'n', true)],
      }],
    }]
    expect(expandBindings(noGameId)[0].query).toEqual({ gameId: 3, roleId: '1', serverId: '1' })
  })
})

describe('isAlreadyAttended', () => {
  const nowSec = Math.floor(Date.now() / 1000)

  it('明日方舟看 records 里的日期', () => {
    expect(isAlreadyAttended({ data: { records: [{ ts: String(nowSec) }] } })).toBe(true)
    expect(isAlreadyAttended({ data: { records: [{ ts: String(nowSec - 86400) }] } })).toBe(false)
    expect(isAlreadyAttended({ data: { records: [] } })).toBe(false)
  })

  it('终末地看 hasToday', () => {
    expect(isAlreadyAttended({ data: { hasToday: true } })).toBe(true)
    expect(isAlreadyAttended({ data: { hasToday: false } })).toBe(false)
  })

  it('异常输入不误判、不抛错', () => {
    expect(isAlreadyAttended({ data: {} })).toBe(false)
    expect(isAlreadyAttended(null)).toBe(false)
    expect(isAlreadyAttended(undefined)).toBe(false)
  })
})

describe('formatAwards', () => {
  it('格式化明日方舟奖励', () => {
    const text = formatAwards('arknights', {
      ts: 1,
      awards: [
        { resource: { id: '1', name: '龙门币', type: 'GOLD' }, count: 3000 },
        { resource: { id: '2', name: '合成玉', type: 'DIAMOND' }, count: 100 },
      ],
    })
    expect(text).toContain('「龙门币」3000个')
    expect(text).toContain('「合成玉」100个')
  })

  it('终末地奖励从 resourceInfoMap 查名称与数量', () => {
    const text = formatAwards('endfield', {
      awardIds: [{ id: 'a1', type: 1 }, { id: 'a2', type: 1 }],
      resourceInfoMap: {
        a1: { count: 5, icon: '', id: 'a1', name: '源石' },
        a2: { count: 2, icon: '', id: 'a2', name: '嵌合宝箱' },
      },
      tomorrowAwardIds: [],
      ts: '1',
    })
    expect(text).toContain('「源石」5个')
    expect(text).toContain('「嵌合宝箱」2个')
  })

  it('终末地奖励 id 查不到时降级，不崩', () => {
    const text = formatAwards('endfield', {
      awardIds: [{ id: 'missing', type: 1 }],
      resourceInfoMap: {},
      tomorrowAwardIds: [],
      ts: '1',
    })
    expect(text).toContain('未知奖励')
  })
})
