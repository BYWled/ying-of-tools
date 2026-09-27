import { useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { Moon, Sun, Wrench } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { Button } from '@/components/ui/button'
import { SITE } from '@/config/site'

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="切换主题"
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
    >
      {resolvedTheme === 'dark' ? <Sun className="size-5" /> : <Moon className="size-5" />}
    </Button>
  )
}

function Logo({ to = '/' }: { to?: string }) {
  return (
    <Link to={to} className="flex items-center gap-2.5 shrink-0">
      <img src="/favicon.svg" alt="" className="size-8 rounded-lg" />
      <span className="font-heading text-lg font-semibold tracking-tight">{SITE.name}</span>
    </Link>
  )
}

export function TopBar() {
  const [scrolled, setScrolled] = useState(false)
  useLocation() // 路由变化时保留 sticky 行为即可
  return (
    <header
      onScrollCapture={() => setScrolled(window.scrollY > 4)}
      className={`sticky top-0 z-50 h-16 border-b backdrop-blur-md transition-colors ${
        scrolled ? 'bg-background/85' : 'bg-background/70'
      }`}
    >
      <div className="mx-auto flex h-full w-full max-w-6xl items-center justify-between px-4">
        <Logo />
        <div className="flex items-center gap-1">
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}

function Footer() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="mx-auto w-full max-w-6xl px-4 py-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="max-w-md space-y-2">
            <div className="flex items-center gap-2">
              <Wrench className="text-primary size-4" />
              <span className="font-heading font-semibold">{SITE.name}</span>
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {SITE.description}
            </p>
          </div>
          <div className="text-muted-foreground space-y-1.5 text-sm">
            <p>
              纯前端架构 · 无上传 · 无注册 · 免费使用
            </p>
            <p>
              React 19 + Vite + Tailwind CSS · ffmpeg.wasm / pdf-lib / jSquash
            </p>
            <p>© {new Date().getFullYear()} Banying · UI 风格参考「光谱」设计语言</p>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default function ImmersiveLayout() {
  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col font-sans">
      <TopBar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
