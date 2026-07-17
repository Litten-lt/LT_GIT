import { useEffect, useState } from 'react'

export default function ReadingProgress() {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const update = () => {
      const root = document.documentElement
      const total = root.scrollHeight - root.clientHeight
      setProgress(total > 0 ? Math.min(100, (root.scrollTop / total) * 100) : 0)
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  return <div className="reading-progress" aria-hidden="true"><span style={{ width: progress + '%' }} /></div>
}
