// Hero 背景设置读写
// - 后端存 settings 表，前端使用 longteng.heroBg 并兼容旧缓存键
// - 类型: 'color' | 'gradient' | 'image' | 'default'
// - value: hex 颜色 / gradient css / 图片文件名

import { getToken } from './auth'

const CACHE_KEY = 'longteng.heroBg'
const LEGACY_CACHE_KEY = 'chesshub.heroBg'

export type HeroBg =
  | { type: 'color'; value: string }
  | { type: 'gradient'; value: string }
  | { type: 'image'; value: string; url: string }
  | { type: 'default'; value: string }

export const DEFAULT_HERO_BG: HeroBg = { type: 'color', value: '#ebe4d8' }

// 6 个预设 (admin 在 BackgroundPicker 里展示)
export const PRESET_BG = [
  { type: 'color' as const, value: '#ebe4d8', label: '奶茶' },
  { type: 'color' as const, value: '#dde4ea', label: '雾蓝' },
  { type: 'color' as const, value: '#efeae3', label: '暖灰' },
  { type: 'color' as const, value: '#dde3d8', label: '墨绿' },
  { type: 'color' as const, value: '#3a3936', label: '深灰' },
  {
    type: 'gradient' as const,
    value: 'linear-gradient(135deg, #f5e6d3 0%, #f0d5c0 100%)',
    label: '暖阳',
  },
]

function authHeader(): Record<string, string> {
  const t = getToken()
  return t ? { Authorization: `Bearer ${t}` } : {}
}

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

// PUT 预设 (color / gradient)
export async function setPresetHeroBg(
  type: 'color' | 'gradient',
  value: string,
): Promise<HeroBg> {
  const r = await fetch('/api/settings/hero-bg', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify({ type, value }),
  })
  if (!r.ok) {
    const err = await r.json().catch(() => ({}))
    throw new Error(err.error || `HTTP ${r.status}`)
  }
  const bg: HeroBg = { type, value }
  setCachedHeroBg(bg)
  return bg
}

// POST 上传图片
export async function uploadHeroBg(file: File): Promise<HeroBg> {
  const form = new FormData()
  form.append('file', file)
  const r = await fetch('/api/settings/hero-bg/upload', {
    method: 'POST',
    headers: { ...authHeader() },
    body: form,
  })
  if (!r.ok) {
    const err = await r.json().catch(() => ({}))
    throw new Error(err.error || `HTTP ${r.status}`)
  }
  const data = (await r.json()) as { type: 'image'; value: string; url: string }
  const bg: HeroBg = { type: 'image', value: data.value, url: data.url }
  setCachedHeroBg(bg)
  return bg
}

// DELETE 重置默认
export async function resetHeroBg(): Promise<HeroBg> {
  const r = await fetch('/api/settings/hero-bg', {
    method: 'DELETE',
    headers: { ...authHeader() },
  })
  if (!r.ok) {
    const err = await r.json().catch(() => ({}))
    throw new Error(err.error || `HTTP ${r.status}`)
  }
  setCachedHeroBg(DEFAULT_HERO_BG)
  return DEFAULT_HERO_BG
}
