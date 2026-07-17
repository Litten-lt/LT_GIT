// Hero 背景切换浮层 (admin only)
// - 6 个预设色板 (含渐变)
// - 上传图片做背景
// - 重置默认
// 选完/传完自动关闭,onChange 回调通知 Home 刷新

import { useEffect, useRef, useState } from 'react'
import {
  PRESET_BG,
  HeroBg,
  bgToStyle,
  setPresetHeroBg,
  uploadHeroBg,
  resetHeroBg,
} from '../background'

type Props = {
  open: boolean
  current: HeroBg
  onClose: () => void
  onChange: (bg: HeroBg) => void
}

export default function BackgroundPicker({ open, current, onClose, onChange }: Props) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ESC 关闭
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, busy, onClose])

  // 关闭时清错
  useEffect(() => {
    if (!open) setErr(null)
  }, [open])

  if (!open) return null

  const apply = async (fn: () => Promise<HeroBg>) => {
    setBusy(true)
    setErr(null)
    try {
      const bg = await fn()
      onChange(bg)
      onClose()
    } catch (e: any) {
      setErr(e?.message || '操作失败')
    } finally {
      setBusy(false)
    }
  }

  const handlePickPreset = (type: 'color' | 'gradient', value: string) =>
    apply(() => setPresetHeroBg(type, value))

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    apply(() => uploadHeroBg(file))
    // 清空 input 让下次选同一文件还能触发 change
    e.target.value = ''
  }

  const handleReset = () => apply(() => resetHeroBg())

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose()
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-ink/10">
          <div>
            <div className="text-base font-semibold text-ink">Hero 区背景</div>
            <div className="text-xs text-ink-soft mt-0.5">仅 admin 可改</div>
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            className="text-ink-soft hover:text-ink disabled:opacity-40 text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-full hover:bg-ink/5 transition"
            aria-label="关闭"
          >
            ×
          </button>
        </div>

        {/* 预设色板 */}
        <div className="px-5 pt-5 pb-2">
          <div className="text-xs font-mono text-ink-soft/70 tracking-widest mb-3">
            预设
          </div>
          <div className="grid grid-cols-3 gap-3">
            {PRESET_BG.map((p) => {
              const isActive =
                current.type === p.type && current.value === p.value
              const style = bgToStyle(p as HeroBg)
              return (
                <button
                  key={`${p.type}-${p.value}`}
                  onClick={() => handlePickPreset(p.type, p.value)}
                  disabled={busy}
                  className={`group relative aspect-square rounded-xl border-2 transition overflow-hidden disabled:opacity-50 ${
                    isActive
                      ? 'border-accent ring-2 ring-accent/30 ring-offset-2'
                      : 'border-ink/10 hover:border-ink/30'
                  }`}
                  style={{ background: style.background }}
                >
                  <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 text-[10px] font-medium px-1.5 py-0.5 rounded bg-white/90 text-ink shadow-sm whitespace-nowrap">
                    {p.label}
                  </span>
                  {isActive && (
                    <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-accent text-white text-[10px] flex items-center justify-center">
                      ✓
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* 上传图片 */}
        <div className="px-5 py-4">
          <div className="text-xs font-mono text-ink-soft/70 tracking-widest mb-2">
            自定义图片
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleUpload}
            disabled={busy}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            className="w-full px-4 py-3 border-2 border-dashed border-ink/15 hover:border-accent/40 hover:bg-accent-soft rounded-xl text-sm text-ink-soft hover:text-ink transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <span className="text-lg">🖼</span>
            <span>点击上传图片 (jpg/png/webp,≤5MB)</span>
          </button>
          {current.type === 'image' && (
            <div className="mt-2 text-xs text-ink-soft/70 truncate">
              当前图片: {current.value}
            </div>
          )}
        </div>

        {/* 错误 + 重置 */}
        <div className="px-5 pb-5 flex items-center gap-3">
          <button
            onClick={handleReset}
            disabled={busy}
            className="text-xs text-ink-soft hover:text-accent transition disabled:opacity-50"
          >
            ↺ 重置默认
          </button>
          <div className="flex-1" />
          {err && <span className="text-xs text-red-600">{err}</span>}
          {busy && <span className="text-xs text-ink-soft">处理中…</span>}
        </div>
      </div>
    </div>
  )
}