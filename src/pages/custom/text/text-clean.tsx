import { useMemo, useState } from 'react'
import { Eraser } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { SimpleSelect } from '@/components/ui/select'
import { CopyButton, ToolShell } from '@/components/tool-shell'

type SortMode = 'none' | 'asc' | 'desc' | 'len' | 'shuffle'

export default function TextCleanPage() {
  const [text, setText] = useState('第二行\n第一行\n第一行\n\n  带空格的行  \n第三行')
  const [o, setO] = useState({
    trim: true,
    dedup: false,
    dropEmpty: false,
    dropComment: false,
    collapseBlank: false,
    toHalf: false,
    addPrefix: '',
    addSuffix: '',
  })
  const [sort, setSort] = useState<SortMode>('none')
  const [find, setFind] = useState('')
  const [replaceWith, setReplaceWith] = useState('')
  const [useRegex, setUseRegex] = useState(false)

  const result = useMemo(() => {
    let lines = text.split('\n')
    if (o.toHalf) {
      lines = lines.map((l) =>
        l.replace(/[\uFF01-\uFF5E]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0)).replace(/\u3000/g, ' '),
      )
    }
    if (o.trim) lines = lines.map((l) => l.trim())
    if (o.dropEmpty) lines = lines.filter((l) => l.trim() !== '')
    if (o.dropComment) lines = lines.filter((l) => !l.trimStart().startsWith('#'))
    if (find) {
      try {
        const re = useRegex ? new RegExp(find, 'g') : find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        lines = lines.map((l) => l.replace(re, replaceWith))
      } catch {
        /* 正则非法时保持原样 */
      }
    }
    if (o.addPrefix || o.addSuffix) lines = lines.map((l) => `${o.addPrefix}${l}${o.addSuffix}`)
    if (sort === 'asc') lines = [...lines].sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'))
    else if (sort === 'desc') lines = [...lines].sort((a, b) => b.localeCompare(a, 'zh-Hans-CN'))
    else if (sort === 'len') lines = [...lines].sort((a, b) => a.length - b.length)
    else if (sort === 'shuffle') {
      for (let i = lines.length - 1; i > 0; i--) {
        const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1)
        ;[lines[i], lines[j]] = [lines[j], lines[i]]
      }
    }
    if (o.dedup) {
      const seen = new Set<string>()
      lines = lines.filter((l) => (seen.has(l) ? false : (seen.add(l), true)))
    }
    if (o.collapseBlank) lines = lines.filter((l, i) => l !== '' || lines[i - 1] !== '')
    return lines.join('\n')
  }, [text, o, sort, find, replaceWith, useRegex])

  const toggles: { key: keyof typeof o; label: string }[] = [
    { key: 'trim', label: '去除每行首尾空格' },
    { key: 'dropEmpty', label: '删除空行' },
    { key: 'dedup', label: '行内容去重' },
    { key: 'dropComment', label: '删除 # 注释行' },
    { key: 'collapseBlank', label: '合并连续空行为一行' },
    { key: 'toHalf', label: '全角转半角' },
  ]

  return (
    <ToolShell
      title="文本批量处理"
      desc="去重、去空行、排序、全半角、添加前后缀、查找替换（支持正则），所有规则实时叠加预览"
      wide
    >
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="space-y-1.5">
          <span className="text-muted-foreground text-xs font-medium">原始文本</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={14}
            spellCheck={false}
            className="border-input bg-muted/30 w-full rounded-lg border p-3 font-mono text-xs leading-relaxed outline-none focus:border-primary/50"
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs font-medium">处理结果（{result.split('\n').length} 行）</span>
            <div className="flex gap-2">
              <CopyButton text={result} />
              <Button variant="ghost" size="sm" onClick={() => setText(result)}>
                <Eraser />
                应用为输入
              </Button>
            </div>
          </div>
          <textarea
            value={result}
            readOnly
            rows={14}
            className="border-input bg-muted/30 w-full rounded-lg border p-3 font-mono text-xs leading-relaxed outline-none"
          />
        </div>
      </div>

      <div className="grid gap-4 rounded-xl border p-4 sm:grid-cols-2">
        <div className="space-y-2.5">
          {toggles.map((t) => (
            <label key={t.key} className="flex items-center justify-between gap-4 text-sm">
              {t.label}
              <Switch
                checked={Boolean(o[t.key])}
                onCheckedChange={(v) => setO({ ...o, [t.key]: v })}
              />
            </label>
          ))}
        </div>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <span className="text-muted-foreground text-xs font-medium">行排序</span>
            <SimpleSelect
              value={sort}
              onChange={(v) => setSort(v as SortMode)}
              options={[
                { value: 'none', label: '不排序' },
                { value: 'asc', label: '按内容升序（拼音）' },
                { value: 'desc', label: '按内容降序' },
                { value: 'len', label: '按长度升序' },
                { value: 'shuffle', label: '随机打乱' },
              ]}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <span className="text-muted-foreground text-xs font-medium">查找</span>
              <Input value={find} onChange={(e) => setFind(e.target.value)} placeholder="要替换的内容" className="font-mono text-xs" />
            </div>
            <div className="space-y-1.5">
              <span className="text-muted-foreground text-xs font-medium">替换为</span>
              <Input value={replaceWith} onChange={(e) => setReplaceWith(e.target.value)} placeholder="留空即删除" className="font-mono text-xs" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            按正则匹配
            <Switch checked={useRegex} onCheckedChange={setUseRegex} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <span className="text-muted-foreground text-xs font-medium">行首添加</span>
              <Input value={o.addPrefix} onChange={(e) => setO({ ...o, addPrefix: e.target.value })} placeholder="如 &quot; 或 '" className="font-mono text-xs" />
            </div>
            <div className="space-y-1.5">
              <span className="text-muted-foreground text-xs font-medium">行尾添加</span>
              <Input value={o.addSuffix} onChange={(e) => setO({ ...o, addSuffix: e.target.value })} placeholder="如 , 或 )" className="font-mono text-xs" />
            </div>
          </div>
        </div>
      </div>
    </ToolShell>
  )
}
