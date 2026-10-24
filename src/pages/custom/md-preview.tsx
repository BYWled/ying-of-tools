import { useEffect, useMemo, useState } from 'react'
import { CopyButton, ToolShell } from '@/components/tool-shell'
import { downloadBlob } from '@/lib/utils'

/** 基础清洗：移除脚本/事件属性/javascript: 链接（本地预览工具的安全兜底） */
function sanitize(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelectorAll('script, iframe, object, embed, link, meta').forEach((n) => n.remove())
  doc.querySelectorAll('*').forEach((el) => {
    for (const attr of [...el.attributes]) {
      if (/^on/i.test(attr.name)) el.removeAttribute(attr.name)
      if ((attr.name === 'href' || attr.name === 'src') && /^\s*javascript:/i.test(attr.value)) {
        el.setAttribute(attr.name, '#')
      }
    }
  })
  return doc.body.innerHTML
}

export default function MdPreviewPage() {
  const [md, setMd] = useState(
    '# Markdown 实时预览\n\n支持 **加粗**、*斜体*、`行内代码`、[链接](https://tools.wled.top)\n\n- 列表项一\n- 列表项二\n\n> 引用：所有渲染都在浏览器本地完成\n\n```js\nconst hello = (name) => `你好，${name}`\n```\n\n| 列 A | 列 B |\n|------|------|\n| 1    | 2    |\n',
  )
  const [render, setRender] = useState<((s: string) => string) | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    let alive = true
    import('marked')
      .then((m) => {
        if (!alive) return
        m.marked.setOptions({ async: false, gfm: true, breaks: true })
        setRender(() => (s: string) => sanitize(m.marked.parse(s, { async: false }) as string))
      })
      .catch(() => alive && setErr('渲染引擎加载失败，请刷新重试'))
    return () => {
      alive = false
    }
  }, [])

  const html = useMemo(() => (render && md ? render(md) : ''), [render, md])

  return (
    <ToolShell
      title="Markdown 编辑预览"
      desc="左侧编辑、右侧实时渲染，支持 GFM 表格与代码块，可导出 HTML 文件"
      wide
    >
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs font-medium">Markdown</span>
            <CopyButton text={md} />
          </div>
          <textarea
            value={md}
            onChange={(e) => setMd(e.target.value)}
            rows={20}
            spellCheck={false}
            placeholder="输入 Markdown…"
            className="border-input bg-muted/30 w-full rounded-lg border p-3 font-mono text-xs leading-relaxed outline-none focus:border-primary/50"
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs font-medium">预览</span>
            <button
              className="text-muted-foreground hover:text-foreground text-xs underline-offset-2 hover:underline"
              onClick={() =>
                downloadBlob(
                  new Blob([`<!doctype html><meta charset="utf-8"><body style="max-width:760px;margin:40px auto;padding:0 20px;font-family:system-ui;line-height:1.7">${html}</body>`],
                    { type: 'text/html;charset=utf-8' }),
                  'markdown-预览.html',
                )
              }
            >
              导出 HTML
            </button>
          </div>
          <div className="prose-container bg-muted/30 min-h-[420px] overflow-auto rounded-lg border p-4">
            {err ? (
              <p className="text-destructive text-sm">{err}</p>
            ) : (
              <div className="md-body text-sm" dangerouslySetInnerHTML={{ __html: html }} />
            )}
          </div>
        </div>
      </div>
    </ToolShell>
  )
}
