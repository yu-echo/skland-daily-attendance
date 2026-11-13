import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  ALL_COMMUNITY_ACTIONS,
  communityOptionsFromEnv,
  DEFAULT_COMMUNITY_ACTIONS,
  isAlreadyDone,
  parseActions,
} from './community'

describe('parseActions', () => {
  it('未设置时回落到默认动作（不含分享）', () => {
    expect([...parseActions(undefined)]).toEqual(DEFAULT_COMMUNITY_ACTIONS)
    expect([...parseActions('')]).toEqual(DEFAULT_COMMUNITY_ACTIONS)
    expect(parseActions(undefined).has('share')).toBe(false)
  })

  it('all / * 展开成全部动作', () => {
    expect([...parseActions('all')].sort()).toEqual([...ALL_COMMUNITY_ACTIONS].sort())
    expect([...parseActions('*')].sort()).toEqual([...ALL_COMMUNITY_ACTIONS].sort())
  })

  it('off 系列返回空集合', () => {
    for (const value of ['off', 'none', '0', 'false', 'OFF'])
      expect(parseActions(value).size).toBe(0)
  })

  it('逐个列举，大小写与分隔符都容忍', () => {
    expect([...parseActions('checkin,like')].sort()).toEqual(['checkin', 'like'])
    expect([...parseActions('Checkin; VIEW share')].sort()).toEqual(['checkin', 'share', 'view'])
  })

  it('丢掉不认识的动作名', () => {
    expect([...parseActions('checkin,bogus,like')].sort()).toEqual(['checkin', 'like'])
  })

  it('全是无效动作时返回空集合（等价于不跑）', () => {
    expect(parseActions('bogus,nope').size).toBe(0)
  })
})

describe('isAlreadyDone', () => {
  it('识别服务端的重复提示', () => {
    expect(isAlreadyDone('重复签到')).toBe(true)
    expect(isAlreadyDone('今日已检票')).toBe(true)
    expect(isAlreadyDone('already checked')).toBe(true)
    expect(isAlreadyDone('HTTP 403 已经签到过了')).toBe(true)
  })

  it('普通错误不算「已做过」', () => {
    expect(isAlreadyDone('系统繁忙，请稍后再试')).toBe(false)
    expect(isAlreadyDone('')).toBe(false)
    expect(isAlreadyDone(undefined)).toBe(false)
    expect(isAlreadyDone(null)).toBe(false)
  })
})

describe('communityOptionsFromEnv', () => {
  const saved: Record<string, string | undefined> = {}
  const keys = [
    'SKLAND_COMMUNITY',
    'SKLAND_COMMUNITY_ACTIONS',
    'SKLAND_COMMUNITY_VIEW',
    'SKLAND_COMMUNITY_LIKE',
    'SKLAND_COMMUNITY_SHARE',
    'SKLAND_COMMUNITY_ZONES',
    'SKLAND_COMMUNITY_INTERVAL',
  ]

  beforeEach(() => {
    for (const key of keys) {
      saved[key] = process.env[key]
      delete process.env[key]
    }
  })

  afterEach(() => {
    for (const key of keys) {
      if (saved[key] === undefined)
        delete process.env[key]
      else
        process.env[key] = saved[key]
    }
  })

  it('默认开启且用服务端配额', () => {
    const options = communityOptionsFromEnv()
    expect(options).not.toBeNull()
    expect([...options!.actions].sort()).toEqual([...DEFAULT_COMMUNITY_ACTIONS].sort())
    expect(options!.viewCount).toBe(5)
    expect(options!.likeCount).toBe(10)
    expect(options!.shareCount).toBe(1)
    expect(options!.zoneIds.size).toBe(0)
  })

  it('开关设为 off 时完全不跑', () => {
    process.env.SKLAND_COMMUNITY = 'off'
    expect(communityOptionsFromEnv()).toBeNull()
  })

  it('动作为空时不跑，避免白登录一趟', () => {
    process.env.SKLAND_COMMUNITY_ACTIONS = 'off'
    expect(communityOptionsFromEnv()).toBeNull()
  })

  it('配额可调，非法值回落默认', () => {
    process.env.SKLAND_COMMUNITY_VIEW = '3'
    process.env.SKLAND_COMMUNITY_LIKE = '-5'
    process.env.SKLAND_COMMUNITY_SHARE = 'abc'
    const options = communityOptionsFromEnv()!
    expect(options.viewCount).toBe(3)
    expect(options.likeCount).toBe(10)
    expect(options.shareCount).toBe(1)
  })

  it('配额有上限，防止把数字写过火', () => {
    process.env.SKLAND_COMMUNITY_LIKE = '9999'
    expect(communityOptionsFromEnv()!.likeCount).toBe(50)
  })

  it('版区过滤只认正整数', () => {
    process.env.SKLAND_COMMUNITY_ZONES = '1, 3，x, 0, -2'
    expect([...communityOptionsFromEnv()!.zoneIds].sort()).toEqual([1, 3])
  })

  it('间隔有上限，防止误设成小时级', () => {
    process.env.SKLAND_COMMUNITY_INTERVAL = '999999'
    expect(communityOptionsFromEnv()!.interval).toBe(10000)
  })
})
