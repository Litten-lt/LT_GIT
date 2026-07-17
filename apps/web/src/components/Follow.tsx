import {
  BilibiliIcon,
  WeiboIcon,
  GithubIcon,
  InstagramIcon,
  TwitterXIcon,
  DouyinIcon,
} from './social-icons'

type Social = {
  label: string
  href: string
  icon: (p: { className?: string }) => JSX.Element
}

const socials: Social[] = [
  { label: 'B站', href: 'https://space.bilibili.com/', icon: BilibiliIcon },
  { label: '抖音', href: 'https://www.douyin.com/', icon: DouyinIcon },
  { label: '微博', href: 'https://weibo.com/', icon: WeiboIcon },
  { label: 'Instagram', href: 'https://instagram.com/', icon: InstagramIcon },
  { label: 'X', href: 'https://x.com/', icon: TwitterXIcon },
  { label: 'GitHub', href: 'https://github.com/Litten-lt', icon: GithubIcon },
]

export default function Follow() {
  return (
    <section id="follow">
      <div className="text-center mb-10">
        <p className="text-xs font-mono text-accent mb-3 tracking-widest">/ FOLLOW</p>
        <h2 className="text-3xl md:text-4xl font-extrabold text-ink">
          关注我<span className="text-accent">.</span>
        </h2>
        <p className="mt-3 text-ink-soft">在别的地方也找得到我</p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-4">
        {socials.map((s) => {
          const Icon = s.icon
          return (
            <a
              key={s.label}
              href={s.href}
              target="_blank"
              rel="noreferrer"
              className="group flex flex-col items-center"
            >
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-white transition lift"
                style={{ background: '#c58582' }}
              >
                <Icon className="w-7 h-7" />
              </div>
              <span
                className="mt-2 text-xs text-ink-soft group-hover:text-accent transition"
                style={{ fontFamily: 'Fraunces, "Source Han Serif SC", Georgia, serif' }}
              >
                {s.label}
              </span>
            </a>
          )
        })}
      </div>
    </section>
  )
}