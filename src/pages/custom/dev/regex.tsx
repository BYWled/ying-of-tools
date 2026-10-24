import { useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { ErrorText, TextArea, ToolShell } from '@/components/tool-shell'

export default function RegexPage() {
  const [pattern, setPattern] = useState('(\\w+)@(\\w+)\\.com')
  const [flags, setFlags] = useState('g')
  const [text, setText] = useState('联系 alice@example.com 或 bob@test.com，也可以发到 grace@example.com。')
  const [replacement, setReplacement] = useState('[$1#at$2]')

  const result = useMemo(() => {
    if (!pattern) return { ok: false, msg: '', matches: [], parts: [] as { text: string; hit: boolean }[] }
    let re: RegExp
    try {
      re = new RegExp(pattern, flags.includes('g') ? flags : flags + 'g')
    } catch (e) {
      return { ok: false, msg: e instanceof Error ? e.message : String(e), matches: [], parts: [] as { text: string; hit: boolean }[] }
    }
    const matches: { text: string; index: number; groups: string[] }[] = []
    const parts: { text: string; hit: boolean }[] = []
    let last = 0
    let m: RegExpExecArray | null
    let guard = 0
    while ((m = re.exec(text)) !== null) {
      if (m[0] === '' ) re.lastIndex++
      if (guard++ > 5000) break
      matches.push({ text: m[0], index: m.index, groups: m.slice(1).map((g) => g ?? '—') })
      if (m.index > last) parts.push({ text: text.slice(last, m.index), hit: false })
      parts.push({ text: m[0], hit: true })
      last = m.index + m[0].length
      if (m[0] === '') continue
    }
    if (last < text.length) parts.push({ text: text.slice(last), hit: false })
    let replaced = ''
    try {
      replaced = text.replace(new RegExp(pattern, flags.includes('g') ? flags : flags + 'g'), replacement)
    } catch {
      replaced = ''
    }
    return { ok: true, msg: '', matches, parts, replaced }
  }, [pattern, flags, text, replacement])

  return (
    <ToolShell title="正则表达式测试" desc="实时匹配高亮、捕获分组表格与替换预览">
      <div className="rounded-xl border p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-64 flex-1 space-y-1.5">
            <span className="text-muted-foreground text-xs font-medium">正则表达式</span>
            <div className="flex items-center gap-1 font-mono">
              <span className="text-muted-foreground">/</span>
              <Input value={pattern} onChange={(e) => setPattern(e.target.value)} className="font-mono" placeholder="如 \\d+" />
              <span className="text-muted-foreground">/</span>
            </div>
          </div>
          <div className="w-32 space-y-1.5">
            <span className="text-muted-foreground text-xs font-medium">标志</span>
            <Input value={flags} onChange={(e) => setFlags(e.target.value.replace(/[^gimsuy]/g, ''))} className="font-mono" placeholder="g i m" />
          </div>
        </div>
        <ErrorText>{result.msg}</ErrorText>

        <div className="mt-3 space-y-1.5">
          <span className="text-muted-foreground text-xs font-medium">测试文本</span>
          <TextArea value={text} onChange={setText} rows={4} />
        </div>

        <div className="mt-3 space-y-1.5">
          <span className="text-muted-foreground text-xs font-medium">匹配高亮（{result.matches.length} 处）</span>
          <div className="bg-muted/30 min-h-16 rounded-lg border p-3 text-sm leading-relaxed break-all">
            {result.parts.length === 0 && text && <span className="text-muted-foreground">无匹配</span>}
            {result.parts.map((p, i) =>
              p.hit ? (
                <mark key={i} className="bg-primary/25 text-primary rounded px-0.5">{p.text}</mark>
              ) : (
                <span key={i}>{p.text}</span>
              ),
            )}
          </div>
        </div>

        {result.matches.length > 0 && (
          <div className="mt-3 overflow-hidden rounded-lg border">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">#</th>
                  <th className="px-3 py-2 text-left font-medium">位置</th>
                  <th className="px-3 py-2 text-left font-medium">匹配内容</th>
                  <th className="px-3 py-2 text-left font-medium">捕获分组</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {result.matches.slice(0, 200).map((m, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-3 py-1.5">{i + 1}</td>
                    <td className="px-3 py-1.5">{m.index}</td>
                    <td className="px-3 py-1.5 break-all">{m.text}</td>
                    <td className="px-3 py-1.5 break-all">
                      {m.groups.length ? m.groups.map((g, gi) => <span key={gi} className="bg-muted mr-1 rounded px-1 py-0.5">{`$${gi + 1}=${g}`}</span>) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-3 space-y-1.5">
          <span className="text-muted-foreground text-xs font-medium">替换预览（替换串支持 $1 $2 引用分组）</span>
          <div className="flex gap-2">
            <Input value={replacement} onChange={(e) => setReplacement(e.target.value)} className="font-mono" />
          </div>
          {result.replaced && (
            <div className="bg-muted/30 rounded-lg border p-3 text-sm break-all">{result.replaced}</div>
          )}
        </div>
      </div>
    </ToolShell>
  )
}
