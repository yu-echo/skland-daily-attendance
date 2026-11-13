export const SKLAND_AUTH_URL = 'https://as.hypergryph.com/user/oauth2/v2/grant'
export const CRED_CODE_URL = 'https://zonai.skland.com/api/v1/user/auth/generate_cred_by_code'
/** 查询绑定角色 url */
export const BINDING_URL = 'https://zonai.skland.com/api/v1/game/player/binding'
/** 明日方舟每日签到 url（查询状态用 GET，签到用 POST） */
export const SKLAND_ATTENDANCE_URL = 'https://zonai.skland.com/api/v1/game/attendance'
/**
 * 终末地每日签到 url
 *
 * 注意这是独立端点，不是明日方舟那个地址换参数：
 * 区服角色信息要通过 `sk-game-role: {gameId}_{roleId}_{serverId}` 请求头传递。
 */
export const ENDFIELD_ATTENDANCE_URL = 'https://zonai.skland.com/api/v1/game/endfield/attendance'

/** 森空岛版区（游戏）列表：社区每日任务靠它枚举要处理的版区 */
export const SKLAND_GAME_LIST_URL = 'https://zonai.skland.com/api/v1/game'
/** 各版区今日检票状态（`checked` 1 = 今天已检票） */
export const SKLAND_CHECKIN_STATUS_URL = 'https://zonai.skland.com/api/v1/score/ischeckin'
/** 版区检票（每个版区每天一次） */
export const SKLAND_CHECKIN_URL = 'https://zonai.skland.com/api/v1/score/checkin'
/** 版区帖子流 */
export const SKLAND_POST_LIST_URL = 'https://zonai.skland.com/api/v1/home/index'
/** 单帖详情：社区任务里的「浏览」就是请求它 */
export const SKLAND_POST_DETAIL_URL = 'https://zonai.skland.com/api/v1/item/list'
/** 点赞 / 取消点赞 */
export const SKLAND_ACTION_URL = 'https://zonai.skland.com/api/v1/action/trigger'
/** 版区分享：社区任务里的「分享」 */
export const SKLAND_SHARE_URL = 'https://zonai.skland.com/api/v1/score/share'

/**
 * 点赞动作码。12 = 点赞，21 = 收藏，取消点赞要打 `/api/v1/action/cancel`。
 * 这个数字跨版本没变过（2023 年的 Go 实现与 2026 年的 Python 实现都是 12）。
 */
export const ACTION_LIKE = 12

/** 帖子流的分类类型：kind = 20 是「综合讨论区」，社区任务的浏览/点赞都从它取帖子 */
export const POST_CATE_KIND = 20

/**
 * 社区任务单个请求的超时（毫秒）。
 *
 * `ofetch` 默认不设超时，社区任务要发几十个请求，任何一个卡住都会把整个 job 拖到超时 ——
 * 而签到结果已经拿到了，不该被一个点赞请求拖死。
 */
export const COMMUNITY_TIMEOUT = 15000

/**
 * 数美科技配置
 * `window._smConf`
 */
export const SKLAND_SM_CONFIG = {
  organization: 'UWXspnCCJN4sfYlNfqps',
  appId: 'default',
  publicKey: 'MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCmxMNr7n8ZeT0tE1R9j/mPixoinPkeM+k4VGIn/s0k7N5rJAfnZ0eMER+QhwFvshzo0LNmeUkpR8uIlU/GEVr8mN28sKmwd2gpygqj0ePnBmOW4v0ZVwbSYK+izkhVFk2V/doLoMbWy6b+UnA8mkjvg0iYWRByfRsK2gdl7llqCwIDAQAB',
  protocol: 'https',
  apiHost: 'fp-it.portal101.cn',
  apiPath: '/deviceprofile/v4',
}

// DES_RULE 的类型定义
export interface DESRule {
  cipher?: string
  is_encrypt: number
  key?: string
  obfuscated_name: string
}

export const DES_RULE: Record<string, DESRule> = {
  appId: {
    cipher: 'DES',
    is_encrypt: 1,
    key: 'uy7mzc4h',
    obfuscated_name: 'xx',
  },
  box: {
    is_encrypt: 0,
    obfuscated_name: 'jf',
  },
  canvas: {
    cipher: 'DES',
    is_encrypt: 1,
    key: 'snrn887t',
    obfuscated_name: 'yk',
  },
  clientSize: {
    cipher: 'DES',
    is_encrypt: 1,
    key: 'cpmjjgsu',
    obfuscated_name: 'zx',
  },
  organization: {
    cipher: 'DES',
    is_encrypt: 1,
    key: '78moqjfc',
    obfuscated_name: 'dp',
  },
  os: {
    cipher: 'DES',
    is_encrypt: 1,
    key: 'je6vk6t4',
    obfuscated_name: 'pj',
  },
  platform: {
    cipher: 'DES',
    is_encrypt: 1,
    key: 'pakxhcd2',
    obfuscated_name: 'gm',
  },
  plugins: {
    cipher: 'DES',
    is_encrypt: 1,
    key: 'v51m3pzl',
    obfuscated_name: 'kq',
  },
  pmf: {
    cipher: 'DES',
    is_encrypt: 1,
    key: '2mdeslu3',
    obfuscated_name: 'vw',
  },
  protocol: {
    is_encrypt: 0,
    obfuscated_name: 'protocol',
  },
  referer: {
    cipher: 'DES',
    is_encrypt: 1,
    key: 'y7bmrjlc',
    obfuscated_name: 'ab',
  },
  res: {
    cipher: 'DES',
    is_encrypt: 1,
    key: 'whxqm2a7',
    obfuscated_name: 'hf',
  },
  rtype: {
    cipher: 'DES',
    is_encrypt: 1,
    key: 'x8o2h2bl',
    obfuscated_name: 'lo',
  },
  sdkver: {
    cipher: 'DES',
    is_encrypt: 1,
    key: '9q3dcxp2',
    obfuscated_name: 'sc',
  },
  status: {
    cipher: 'DES',
    is_encrypt: 1,
    key: '2jbrxxw4',
    obfuscated_name: 'an',
  },
  subVersion: {
    cipher: 'DES',
    is_encrypt: 1,
    key: 'eo3i2puh',
    obfuscated_name: 'ns',
  },
  svm: {
    cipher: 'DES',
    is_encrypt: 1,
    key: 'fzj3kaeh',
    obfuscated_name: 'qr',
  },
  time: {
    cipher: 'DES',
    is_encrypt: 1,
    key: 'q2t3odsk',
    obfuscated_name: 'nb',
  },
  timezone: {
    cipher: 'DES',
    is_encrypt: 1,
    key: '1uv05lj5',
    obfuscated_name: 'as',
  },
  tn: {
    cipher: 'DES',
    is_encrypt: 1,
    key: 'x9nzj1bp',
    obfuscated_name: 'py',
  },
  trees: {
    cipher: 'DES',
    is_encrypt: 1,
    key: 'acfs0xo4',
    obfuscated_name: 'pi',
  },
  ua: {
    cipher: 'DES',
    is_encrypt: 1,
    key: 'k92crp1t',
    obfuscated_name: 'bj',
  },
  url: {
    cipher: 'DES',
    is_encrypt: 1,
    key: 'y95hjkoo',
    obfuscated_name: 'cf',
  },
  version: {
    is_encrypt: 0,
    obfuscated_name: 'version',
  },
  vpw: {
    cipher: 'DES',
    is_encrypt: 1,
    key: 'r9924ab5',
    obfuscated_name: 'ca',
  },
}

export const BROWSER_ENV = {
  plugins: 'MicrosoftEdgePDFPluginPortableDocumentFormatinternal-pdf-viewer1,MicrosoftEdgePDFViewermhjfbmdgcfjbbpaeojofohoefgiehjai1',
  ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0',
  canvas: '259ffe69', // 基于浏览器的canvas获得的值，不知道复用行不行
  timezone: -480, // 时区，应该是固定值吧
  platform: 'Win32',
  url: 'https://www.skland.com/', // 固定值
  referer: '',
  res: '1920_1080_24_1.25', // 屏幕宽度_高度_色深_window.devicePixelRatio
  clientSize: '0_0_1080_1920_1920_1080_1920_1080',
  status: '0011', // 不知道在干啥
}
