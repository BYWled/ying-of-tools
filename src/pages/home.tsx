import { useEffect, useMemo, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ArrowDown,
  BadgeCheck,
  ChevronDown,
  Search,
  ShieldCheck,
  Sparkles,
  WifiOff,
  X,
  Zap,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { GlassCard } from '@/components/glass-card'
import { CATEGORIES, POPULAR_TOOLS, TOOLS, TOOL_COUNT, type ToolDef } from '@/config/tools'
import type { CategoryId } from '@/config/types'
import { cn } from '@/lib/utils'

/* ─────────────────────────── 背景光斑 ─────────────────────────── */

function Blobs() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="bg-chart-3/30 animate-blob absolute -top-24 -left-24 size-96 rounded-full blur-3xl" />
      <div
        className="bg-chart-1/25 animate-blob absolute top-10 right-0 size-80 rounded-full blur-3xl"
        style={{ animationDelay: '-6s' }}
      />
      <div
        className="bg-chart-5/20 animate-blob absolute bottom-0 left-1/3 size-72 rounded-full blur-3xl"
        style={{ animationDelay: '-12s' }}
      />
    </div>
  )
}

/* ─────────────────────────── Hero ─────────────────────────── */

function Hero() {
  return (
    <section className="relative -mx-4 overflow-hidden px-4 pt-6 pb-4 md:pt-10">
      <Blobs />
      <GlassCard glow className="relative mx-auto max-w-3xl px-6 py-12 text-center md:px-12 md:py-16">
        <Badge variant="secondary" className="mb-5 gap-1.5 px-3 py-1">
          <ShieldCheck className="text-primary size-3.5" />
          纯前端 · 文件永不上传 · 完全免费
        </Badge>
        <h1 className="font-heading text-4xl font-bold tracking-tight md:text-6xl">
          伴莺的
          <span className="text-primary">工具箱</span>
        </h1>
        <p className="text-muted-foreground mx-auto mt-5 max-w-xl text-base leading-relaxed md:text-lg">
          {TOOL_COUNT} 个文件工具：格式转换、图片编辑、GIF 处理、PDF 操作、OCR
          识别……一切都在浏览器里完成，不注册、不排队、不限次数，关掉页面数据即刻消失。
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" asChild>
            <a href="#tools">
              浏览全部工具
              <ArrowDown />
            </a>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <a href="#why">它凭什么好用？</a>
          </Button>
        </div>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
          <span className="text-muted-foreground mr-1 text-xs">热门：</span>
          {POPULAR_TOOLS.slice(0, 5).map((t) => (
            <Link key={t.id} to={`/tool/${t.id}`}>
              <Badge variant="outline" className="cursor-pointer px-2.5 py-1 hover:border-primary">
                {t.title}
              </Badge>
            </Link>
          ))}
        </div>
      </GlassCard>

      {/* 数据条 */}
      <div className="relative mx-auto mt-8 grid max-w-2xl grid-cols-2 gap-3 md:grid-cols-4">
        {[
          [String(TOOL_COUNT), '个实用工具'],
          ['6', '大分类'],
          ['0', '次数据上传'],
          ['100%', '免费无限制'],
        ].map(([num, label]) => (
          <div key={label} className="rounded-2xl border bg-card/60 px-4 py-4 text-center backdrop-blur-sm">
            <div className="font-heading text-primary text-2xl font-bold md:text-3xl">{num}</div>
            <div className="text-muted-foreground mt-1 text-xs md:text-sm">{label}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

/* ─────────────────────────── 特性 ─────────────────────────── */

const FEATURES = [
  {
    icon: ShieldCheck,
    title: '隐私是底线',
    desc: '照片、文档、视频从打开到转换全程留在你的设备内存里，没有服务器、没有上传队列，断网照样能用。',
  },
  {
    icon: Zap,
    title: '打开即用',
    desc: '不用安装软件，不用注册账号，没有每日次数限制。批量任务顺序执行，关掉标签页即全部丢弃。',
  },
  {
    icon: Sparkles,
    title: '专业引擎驱动',
    desc: 'ffmpeg.wasm 音视频转码、MozJPEG / OxiPNG 图片压缩、QPDF 文档加密——桌面级引擎的纯前端形态。',
  },
  {
    icon: WifiOff,
    title: '离线友好',
    desc: '界面与引擎全部本地加载，首次使用后浏览器缓存，第二次起不再需要网络（OCR 语言包除外）。',
  },
]

function Why() {
  return (
    <section id="why" className="scroll-mt-24 py-14">
      <h2 className="font-heading mb-2 text-center text-2xl font-semibold md:text-3xl">
        它凭什么好用？
      </h2>
      <p className="text-muted-foreground mb-8 text-center text-sm md:text-base">
        一句话：把格式工厂搬进浏览器，再把隐私还给你。
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="group rounded-2xl border bg-card p-5 transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg"
          >
            <div className="bg-primary/10 text-primary mb-4 flex size-11 items-center justify-center rounded-xl transition-transform group-hover:scale-110">
              <f.icon className="size-5" />
            </div>
            <h3 className="font-semibold">{f.title}</h3>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

/* ─────────────────────────── 工具广场 ─────────────────────────── */

function ToolCard({ tool, onFormatClick }: { tool: ToolDef; onFormatClick?: (f: string) => void }) {
  return (
    <Link
      to={`/tool/${tool.id}`}
      className="group flex flex-col rounded-2xl border bg-card p-5 transition-all hover:border-primary/50 hover:shadow-lg"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-xl transition-transform group-hover:scale-110">
          <tool.icon className="size-5" />
        </div>
        {tool.needsEngine === 'ffmpeg' && (
          <Badge variant="warning" className="text-[10px]">
            需加载引擎
          </Badge>
        )}
      </div>
      <h3 className="font-semibold">{tool.title}</h3>
      <p className="text-muted-foreground mt-1.5 line-clamp-2 text-sm leading-relaxed">{tool.desc}</p>
      {tool.formats && (
        <div className="mt-3 flex flex-wrap gap-1">
          {tool.formats.map((f) => (
            <button
              key={f}
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onFormatClick?.(f)
              }}
              className="bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary cursor-pointer rounded px-1.5 py-0.5 text-[11px] font-mono transition-colors"
              title={`筛选支持 ${f} 的工具`}
            >
              {f}
            </button>
          ))}
        </div>
      )}
    </Link>
  )
}

function ToolSquare() {
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.get('q') ?? ''
  const category = (searchParams.get('cat') as CategoryId | null) ?? null
  const inputRef = useRef<HTMLInputElement>(null)

  const setQuery = (q: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (q) next.set('q', q)
        else next.delete('q')
        return next
      },
      { replace: true },
    )
  }
  const setCategory = (c: CategoryId | null) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (c) next.set('cat', c)
        else next.delete('cat')
        return next
      },
      { replace: true },
    )
  }

  const filtered = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
    return TOOLS.filter((t) => {
      if (category && t.category !== category) return false
      if (!terms.length) return true
      const cat = CATEGORIES.find((c) => c.id === t.category)
      const haystack = [
        t.title,
        t.desc,
        t.id,
        cat?.title ?? '',
        ...(t.formats ?? []),
      ]
        .join(' ')
        .toLowerCase()
      return terms.every((term) => haystack.includes(term))
    })
  }, [query, category])

  const grouped = query.trim() === '' && category === null

  // 快捷键：/ 或 Ctrl+K 聚焦搜索，Esc 清空
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement
      const typing =
        el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || (el instanceof HTMLElement && el.isContentEditable)
      if ((e.key === '/' && !typing) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      } else if (e.key === 'Escape' && el === inputRef.current) {
        setQuery('')
        inputRef.current?.blur()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const countByCat = useMemo(() => {
    const m = new Map<CategoryId, number>()
    for (const t of TOOLS) m.set(t.category, (m.get(t.category) ?? 0) + 1)
    return m
  }, [])

  return (
    <section id="tools" className="scroll-mt-24 py-6">
      <div className="mb-6 flex flex-col items-center gap-4">
        <h2 className="font-heading text-2xl font-semibold md:text-3xl">工具广场</h2>
        <div className="relative w-full max-w-md">
          <Search className="text-muted-foreground absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索工具或格式，空格分隔多个关键词"
            className="bg-card/60 h-11 rounded-full pr-16 pl-10"
          />
          {query ? (
            <button
              type="button"
              aria-label="清空搜索"
              onClick={() => setQuery('')}
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-9 -translate-y-1/2 cursor-pointer"
            >
              <X className="size-4" />
            </button>
          ) : (
            <kbd className="text-muted-foreground bg-muted pointer-events-none absolute top-1/2 right-3.5 hidden -translate-y-1/2 rounded border px-1.5 py-0.5 font-mono text-[10px] md:block">
              /
            </kbd>
          )}
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button
            size="sm"
            variant={category === null ? 'default' : 'outline'}
            className="rounded-full"
            onClick={() => setCategory(null)}
          >
            全部 {TOOLS.length}
          </Button>
          {CATEGORIES.map((c) => (
            <Button
              key={c.id}
              size="sm"
              variant={category === c.id ? 'default' : 'outline'}
              className="rounded-full"
              onClick={() => setCategory(category === c.id ? null : c.id)}
            >
              <c.icon className="size-3.5" />
              {c.title} {countByCat.get(c.id) ?? 0}
            </Button>
          ))}
        </div>
        {!grouped && (
          <p className="text-muted-foreground text-sm">
            {category ? `${CATEGORIES.find((c) => c.id === category)?.title} · ` : ''}
            {query.trim() ? `「${query.trim()}」匹配 ` : ''}
            找到 <span className="text-foreground font-medium">{filtered.length}</span> 个工具
          </p>
        )}
      </div>

      {filtered.length === 0 && (
        <div className="py-16 text-center">
          <p className="text-muted-foreground">没有找到匹配的工具，换个关键词试试？</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => { setQuery(''); setCategory(null) }}>
            清除筛选
          </Button>
        </div>
      )}

      {grouped ? (
        <div className="space-y-10">
          {CATEGORIES.map((c) => {
            const tools = filtered.filter((t) => t.category === c.id)
            if (!tools.length) return null
            return (
              <div key={c.id}>
                <div className="mb-4 flex items-center gap-2.5">
                  <div className="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-lg">
                    <c.icon className="size-4" />
                  </div>
                  <div>
                    <h3 className="font-heading font-semibold">{c.title}</h3>
                    <p className="text-muted-foreground text-xs">{c.desc}</p>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {tools.map((t) => (
                    <ToolCard key={t.id} tool={t} onFormatClick={setQuery} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => (
            <ToolCard key={t.id} tool={t} onFormatClick={setQuery} />
          ))}
        </div>
      )}
    </section>
  )
}

/* ─────────────────────────── FAQ ─────────────────────────── */

const FAQS = [
  {
    q: '我的文件真的不会被上传吗？',
    a: '不会。网站是纯静态页面，没有后端服务器：所有转换都在你的浏览器内存中完成，处理结果也直接从本地下载。你可以打开浏览器开发者工具的网络面板亲眼验证——除了加载页面与引擎文件，没有任何数据请求。',
  },
  {
    q: '为什么音视频工具首次使用要「加载引擎」？',
    a: '音视频转码由 ffmpeg.wasm（约 32 MB 的 WebAssembly 版 FFmpeg）完成。首次使用下载一次，浏览器缓存后，之后访问不再重复下载，并且可以离线使用。如果你的浏览器与站点处于跨源隔离状态，会自动启用多线程核心，速度更快。',
  },
  {
    q: 'DOCX 转 PDF 的效果如何？',
    a: '纯前端条件下采用「高保真分页渲染 + 栅格化导出」方案：先在页面上渲染出分页预览，确认无误后导出为 PDF。文字将变为图片形式（不可选中），复杂版式可能与 Word 有细微出入。若需可选中文字的文档，推荐导出 Markdown / HTML。',
  },
  {
    q: '大文件转换会卡住电脑吗？',
    a: '批量任务按顺序逐个执行，避免多个大文件同时占满内存。视频转码速度取决于文件时长与画质，一般建议单个视频在 500 MB 以内；图片与文档转换则基本秒级完成。',
  },
  {
    q: '支持哪些浏览器？',
    a: '推荐最新版的 Chrome / Edge / Firefox / Safari。图片转换中的 AVIF、JPEG XL 编码与 HEIC 解码基于 WebAssembly，不依赖浏览器原生支持，因此各平台能力一致。',
  },
]

function Faq() {
  return (
    <section className="py-14">
      <h2 className="font-heading mb-8 text-center text-2xl font-semibold md:text-3xl">常见问题</h2>
      <div className="mx-auto max-w-2xl space-y-3">
        {FAQS.map((f) => (
          <details key={f.q} className="group rounded-2xl border bg-card px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
              {f.q}
              <ChevronDown className="text-muted-foreground size-4 shrink-0 transition-transform group-open:rotate-180" />
            </summary>
            <p className="text-muted-foreground mt-3 text-sm leading-relaxed">{f.a}</p>
          </details>
        ))}
      </div>
      <p className="mt-8 flex items-center justify-center gap-1.5 text-center text-sm">
        <BadgeCheck className="text-primary size-4" />
        还有其他想加的工具？架构已为扩展预留好位置。
      </p>
    </section>
  )
}

export default function Home() {
  return (
    <div className="space-y-2">
      <Hero />
      <Why />
      <ToolSquare />
      <Faq />
      <section className={cn('pb-8 text-center')}>
        <Button variant="outline" size="sm" asChild>
          <a href="#top" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>
            回到顶部
          </a>
        </Button>
      </section>
    </div>
  )
}
