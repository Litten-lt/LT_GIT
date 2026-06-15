import { useMemo } from 'react'

export default function Sakura({ count = 12 }: { count?: number }) {
  const petals = useMemo(
    () =>
      Array.from({ length: count }).map((_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 10,
        duration: 12 + Math.random() * 14,
        size: 8 + Math.random() * 10,
        drift: (Math.random() - 0.5) * 60,
      })),
    [count],
  )

  return (
    <>
      {petals.map((p) => (
        <span
          key={p.id}
          className="sakura"
          style={{
            left: `${p.left}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
            ['--drift' as any]: `${p.drift}px`,
          }}
        />
      ))}
    </>
  )
}