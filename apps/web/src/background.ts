// Hero 背景设置读写
// - 后端存 settings 表，前端使用 longteng.heroBg 并兼容旧缓存键
// - 类型: 'color' | 'gradient' | 'image' | 'default'
// - value: hex 颜色 / gradient css / 图片文件名


const CACHE_KEY = 'longteng.heroBg'
const LEGACY_CACHE_KEY = 'chesshub.heroBg'

export type HeroBg =
  | { type: 'color'; value: string }
  | { type: 'gradient'; value: string }
  | { type: 'image'; value: string; url: string }
  | { type: 'default'; value: string }

export const DEFAULT_HERO_BG: HeroBg = { type: 'color', value: '#ebe4d8' }

// 从 localStorage 取缓存 (同步)
export function getCachedHeroBg(): HeroBg {
  if (!localStorage.getItem(CACHE_KEY) && localStorage.getItem(LEGACY_CACHE_KEY)) {
    localStorage.setItem(CACHE_KEY, localStorage.getItem(LEGACY_CACHE_KEY)!)
    localStorage.removeItem(LEGACY_CACHE_KEY)
  }
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return DEFAULT_HERO_BG
}

function setCachedHeroBg(bg: HeroBg) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(bg))
  } catch {}
}

// 从后端拉最新 (异步)
export async function fetchHeroBg(): Promise<HeroBg> {
  try {
    const r = await fetch('/api/settings/hero-bg')
    if (!r.ok) return DEFAULT_HERO_BG
    const bg = (await r.json()) as HeroBg
    setCachedHeroBg(bg)
    return bg
  } catch {
    return getCachedHeroBg()
  }
}

// 应用背景到 inline style
// 返回 { background, isImage }
// - isImage=true 时给外层加蒙版
export function bgToStyle(bg: HeroBg): {
  background: string
  isImage: boolean
} {
  if (bg.type === 'image') {
    return {
      background: `url(${bg.url}) center / cover no-repeat`,
      isImage: true,
    }
  }
  // color / gradient / default 都是直接当 background
  const value =
    bg.type === 'gradient' || bg.type === 'color' ? bg.value : DEFAULT_HERO_BG.value
  return { background: value, isImage: false }
}
