// Hero 背景的全局状态 (Context)
// - 启动时从 localStorage 同步取 (避免初次渲染空白)
// - 然后异步从后端拉最新
// - App 的 picker 改完 → setHeroBg → Home 自动重渲染

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react'
import {
  HeroBg,
  DEFAULT_HERO_BG,
  getCachedHeroBg,
  fetchHeroBg,
} from './background'

type Ctx = {
  heroBg: HeroBg
  setHeroBg: (bg: HeroBg) => void
  reload: () => Promise<void>
}

const HeroBgContext = createContext<Ctx>({
  heroBg: DEFAULT_HERO_BG,
  setHeroBg: () => {},
  reload: async () => {},
})

export function HeroBgProvider({ children }: { children: ReactNode }) {
  // 同步取 localStorage 缓存 (避免先渲染默认再闪一下)
  const [heroBg, _setHeroBg] = useState<HeroBg>(() => getCachedHeroBg())

  const setHeroBg = useCallback((bg: HeroBg) => _setHeroBg(bg), [])

  const reload = useCallback(async () => {
    const bg = await fetchHeroBg()
    _setHeroBg(bg)
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  return (
    <HeroBgContext.Provider value={{ heroBg, setHeroBg, reload }}>
      {children}
    </HeroBgContext.Provider>
  )
}

export function useHeroBg() {
  return useContext(HeroBgContext)
}