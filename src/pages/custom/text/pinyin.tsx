import { useEffect, useMemo, useState } from 'react'
import { SimpleSelect } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { CopyButton, ToolShell } from '@/components/tool-shell'
import type { pinyin } from 'pinyin-pro'

type Mode = 'tone' | 'noTone' | 'initial'

export default function PinyinPage() {
  const [text, setText] = useState('汉字转拼音，你好世界。')
  const [mode, setMode] = useState<Mode>('tone')
  const [sep, setSep] = useState(' ')
  const [multi, setMulti] = useState(false)
  const [fn, setFn] = useState<typeof pinyin | null>(null)
  const [loadErr, setLoadErr] = useState('')

  useEffect(() => {
    let alive = true
    import('pinyin-pro')
      .then((m) => alive && setFn(() => m.pinyin))
      .catch(() => alive && setLoadErr('词典加载失败，请检查网络后刷新'))
    return () => {
      alive = false
    }
  }, [])

  const result = useMemo(() => {
    if (!fn || !text.trim()) return ''
    try {
      if (mode === 'initial') return fn(text, { pattern: 'first', toneType: 'none', type: 'array', nonZh: 'consecutive' }).join('')
      if (multi) return fn(text, { toneType: mode === 'tone' ? 'symbol' : 'none', multiple: true, separator: sep, nonZh: 'consecutive' })
      return fn(text, { toneType: mode === 'tone' ? 'symbol' : 'none', separator: sep, nonZh: 'consecutive' })
    } catch {
      return ''
    }
  }, [fn, text, mode, sep, multi])

  const modeOptions = [
    { value: 'tone', label: '带声调（nǐ hǎo）' },
    { value: 'noTone', label: '不带声调（ni hao）' },
    { value: 'initial', label: '首字母（nh）' },
  ]

  return (
    <ToolShell title="汉字转拼音" desc="多音字智能匹配，支持声调 / 无声调 / 首字母，词库内置浏览器本地运行">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        placeholder="输入汉字…"
        className="border-input bg-muted/30 w-full rounded-lg border p-3 text-sm outline-none focus:border-primary/50"
      />
      <div className="flex flex-wrap items-end gap-4 rounded-xl border p-4">
        <div className="w-48 space-y-1.5">
          <span className="text-muted-foreground text-xs font-medium">输出风格</span>
          <SimpleSelect value={mode} onChange={(v) => setMode(v as Mode)} options={modeOptions} />
        </div>
        {mode !== 'initial' && (
          <div className="w-36 space-y-1.5">
            <span className="text-muted-foreground text-xs font-medium">分隔符</span>
            <SimpleSelect
              value={sep}
              onChange={setSep}
              options={[
                { value: ' ', label: '空格' },
                { value: '', label: '无' },
                { value: "'", label: "撇号 '" },
                { value: '-', label: '中划线' },
              ]}
            />
          </div>
        )}
        <label className="flex items-center gap-2 pb-2 text-sm">
          显示多音字候选
          <Switch checked={multi} onCheckedChange={setMulti} />
        </label>
      </div>

      <div className="bg-muted/40 space-y-2 rounded-xl border p-4">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-xs font-medium">
            结果{fn ? '' : loadErr ? '' : '（词库加载中…）'}
          </span>
          <CopyButton text={result} />
        </div>
        {loadErr ? (
          <p className="text-destructive text-sm">{loadErr}</p>
        ) : (
          <p className="min-h-8 text-lg leading-relaxed break-all">{result || '—'}</p>
        )}
      </div>
    </ToolShell>
  )
}
