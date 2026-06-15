type Skill = {
  name: string
  level: number // 0-100
  note: string
}

const skills: Skill[] = [
  { name: 'C / C++', level: 90, note: '嵌入式主力,7+ 年' },
  { name: 'Lua', level: 80, note: 'OpenWrt / 游戏脚本' },
  { name: 'TypeScript / React', level: 70, note: '业余前端探索' },
  { name: 'Python', level: 65, note: '脚本 / 工具链' },
  { name: 'Shell', level: 75, note: '日常摸鱼' },
  { name: 'Blender', level: 35, note: '学习ing' },
]

export default function Skills() {
  return (
    <section id="skills" className="relative py-24 lg:py-32 bg-bg-soft/40">
      <div className="max-w-6xl mx-auto px-6 lg:px-10">
        <div className="grid lg:grid-cols-[1fr_1.4fr] gap-16">
          {/* 左侧标题 */}
          <div>
            <p className="text-xs font-mono text-accent mb-4 tracking-widest">/ 04 · SKILLS</p>
            <h2 className="text-4xl md:text-5xl font-extrabold text-ink leading-tight dot-accent">
              技能树
            </h2>
            <p className="mt-5 text-ink-soft text-lg leading-relaxed">
              不是简历,只是诚实评估。会啥就写啥,不会的标 LEARNING。
            </p>
          </div>

          {/* 右侧进度条 */}
          <div className="space-y-7">
            {skills.map((s) => (
              <div key={s.name}>
                <div className="flex items-baseline justify-between mb-2">
                  <h3 className="text-base font-semibold text-ink">{s.name}</h3>
                  <span className="font-mono text-xs text-ink-soft/60">{s.level}%</span>
                </div>
                <div className="progress-track">
                  <div
                    className="progress-fill"
                    style={{ transform: `scaleX(${s.level / 100})` }}
                  />
                </div>
                <p className="mt-1.5 text-xs text-ink-soft/70">{s.note}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}