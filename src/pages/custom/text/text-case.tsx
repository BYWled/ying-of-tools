import { useMemo, useState } from 'react'
import { CopyButton, TextArea, ToolShell } from '@/components/tool-shell'

function splitWords(s: string): string[] {
  // 空格/中划线/下划线分隔；支持 camelCase 边界
  return s
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[\s_-]+/)
    .filter(Boolean)
}

const TRANSFORMS: { name: string; fn: (s: string) => string }[] = [
  { name: '全大写', fn: (s) => s.toUpperCase() },
  { name: '全小写', fn: (s) => s.toLowerCase() },
  { name: '标题格式 (Title Case)', fn: (s) => s.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase()) },
  { name: '句首大写', fn: (s) => s.toLowerCase().replace(/(^[.!?。！？]\s*)\S/g, (c) => c.toUpperCase()) },
  { name: '驼峰 camelCase', fn: (s) => splitWords(s).map((w, i) => (i === 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase())).join('') },
  { name: '帕斯卡 PascalCase', fn: (s) => splitWords(s).map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join('') },
  { name: '下划线 snake_case', fn: (s) => splitWords(s).map((w) => w.toLowerCase()).join('_') },
  { name: '中划线 kebab-case', fn: (s) => splitWords(s).map((w) => w.toLowerCase()).join('-') },
  { name: '常量 CONSTANT_CASE', fn: (s) => splitWords(s).map((w) => w.toUpperCase()).join('_') },
  { name: '点分 dot.case', fn: (s) => splitWords(s).map((w) => w.toLowerCase()).join('.') },
  { name: '反转字符串', fn: (s) => [...s].reverse().join('') },
  { name: '每行倒序', fn: (s) => s.split('\n').map((l) => [...l].reverse().join('')).join('\n') },
]

export default function TextCasePage() {
  const [text, setText] = useState('hello world example / user login state')

  const results = useMemo(() => {
    try {
      return TRANSFORMS.map((t) => ({ name: t.name, value: t.fn(text) }))
    } catch {
      return TRANSFORMS.map((t) => ({ name: t.name, value: '' }))
    }
  }, [text])

  return (
    <ToolShell title="大小写 / 命名转换" desc="一键转换 UPPER / lower / Title / camelCase / snake_case / kebab-case 等十二种风格">
      <TextArea value={text} onChange={setText} rows={4} placeholder="输入文本，如 hello world 或 userLoginState…" />
      <div className="grid gap-2">
        {results.map((r) => (
          <div key={r.name} className="bg-muted/40 flex items-center justify-between gap-3 rounded-lg border p-3">
            <div className="min-w-0">
              <p className="text-muted-foreground text-xs">{r.name}</p>
              <p className="truncate font-mono text-sm" title={r.value}>{r.value || '—'}</p>
            </div>
            <CopyButton text={r.value} label="" />
          </div>
        ))}
      </div>
    </ToolShell>
  )
}
