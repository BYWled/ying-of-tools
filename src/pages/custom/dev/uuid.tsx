import { useCallback, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { CopyButton, ToolShell } from '@/components/tool-shell'

function randomId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  // 老浏览器回退：RFC4122 v4
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export default function UuidPage() {
  const [count, setCount] = useState(5)
  const [upper, setUpper] = useState(false)
  const [noHyphen, setNoHyphen] = useState(false)
  const [list, setList] = useState<string[]>(() => Array.from({ length: 5 }, randomId))

  const regenerate = useCallback(() => {
    setList(Array.from({ length: count }, randomId))
  }, [count])

  const formatted = list.map((u) => {
    let s = noHyphen ? u.replace(/-/g, '') : u
    return upper ? s.toUpperCase() : s
  })
  const all = formatted.join('\n')

  return (
    <ToolShell title="UUID 生成器" desc="批量生成符合 RFC 4122 v4 标准的随机 UUID，基于浏览器加密随机源">
      <div className="rounded-xl border p-4">
        <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">数量</span>
            <input
              type="range"
              min={1}
              max={50}
              value={count}
              onChange={(e) => {
                const v = Number(e.target.value)
                setCount(v)
                setList(Array.from({ length: v }, randomId))
              }}
              className="accent-primary w-32"
            />
            <span className="text-muted-foreground w-8 font-mono text-sm">{count}</span>
          </div>
          <label className="flex items-center gap-2 text-sm">
            大写
            <Switch checked={upper} onCheckedChange={setUpper} />
          </label>
          <label className="flex items-center gap-2 text-sm">
            去连字符
            <Switch checked={noHyphen} onCheckedChange={setNoHyphen} />
          </label>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={regenerate}>
              <RefreshCw />
              重新生成
            </Button>
            <CopyButton text={all} label="复制全部" />
          </div>
        </div>
        <div className="bg-muted/30 max-h-96 space-y-1 overflow-auto rounded-lg border p-3">
          {formatted.map((u, i) => (
            <div key={i} className="flex items-center justify-between gap-2">
              <code className="text-xs break-all">{u}</code>
              <CopyButton text={u} label="" />
            </div>
          ))}
        </div>
      </div>
    </ToolShell>
  )
}
