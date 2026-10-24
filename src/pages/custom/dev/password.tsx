import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { CopyButton, ToolShell } from '@/components/tool-shell'

const SETS = {
  lower: 'abcdefghijklmnopqrstuvwxyz',
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  digits: '0123456789',
  symbols: '!@#$%^&*_-+=?',
}
const AMBIGUOUS = /[Il1O0o]/g

function generate(pool: string, length: number): string {
  const bytes = crypto.getRandomValues(new Uint32Array(length))
  let out = ''
  for (let i = 0; i < length; i++) out += pool[bytes[i] % pool.length]
  return out
}

function entropyBits(poolSize: number, length: number): number {
  return Math.round(length * Math.log2(Math.max(2, poolSize)))
}

function strengthLabel(bits: number): { label: string; cls: string } {
  if (bits < 40) return { label: '弱', cls: 'bg-red-500' }
  if (bits < 60) return { label: '一般', cls: 'bg-orange-500' }
  if (bits < 80) return { label: '较强', cls: 'bg-yellow-500' }
  if (bits < 110) return { label: '强', cls: 'bg-emerald-500' }
  return { label: '极强', cls: 'bg-emerald-600' }
}

export default function PasswordPage() {
  const [length, setLength] = useState(16)
  const [opts, setOpts] = useState({ lower: true, upper: true, digits: true, symbols: true, noAmbiguous: true })
  const [list, setList] = useState<string[]>([])

  const pool = useCallback(() => {
    let p = ''
    if (opts.lower) p += SETS.lower
    if (opts.upper) p += SETS.upper
    if (opts.digits) p += SETS.digits
    if (opts.symbols) p += SETS.symbols
    if (opts.noAmbiguous) p = p.replace(AMBIGUOUS, '')
    return p
  }, [opts])

  const regenerate = useCallback(() => {
    const p = pool()
    if (!p) {
      setList([])
      return
    }
    setList(Array.from({ length: 5 }, () => generate(p, length)))
  }, [pool, length])

  useEffect(regenerate, [regenerate])

  const p = pool()
  const bits = entropyBits(p.length, length)
  const s = strengthLabel(bits)

  return (
    <ToolShell title="随机密码生成" desc="基于浏览器加密随机源，自由组合字符集，附熵值强度评估">
      <div className="rounded-xl border p-4">
        <div className="mb-4 flex items-center gap-3">
          <span className="text-sm font-medium">长度</span>
          <input
            type="range"
            min={6}
            max={64}
            value={length}
            onChange={(e) => setLength(Number(e.target.value))}
            className="accent-primary flex-1"
          />
          <span className="text-muted-foreground w-10 font-mono text-sm">{length}</span>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
          <label className="flex items-center gap-2 text-sm">
            小写字母
            <Switch checked={opts.lower} onCheckedChange={(v) => setOpts({ ...opts, lower: v })} />
          </label>
          <label className="flex items-center gap-2 text-sm">
            大写字母
            <Switch checked={opts.upper} onCheckedChange={(v) => setOpts({ ...opts, upper: v })} />
          </label>
          <label className="flex items-center gap-2 text-sm">
            数字
            <Switch checked={opts.digits} onCheckedChange={(v) => setOpts({ ...opts, digits: v })} />
          </label>
          <label className="flex items-center gap-2 text-sm">
            符号
            <Switch checked={opts.symbols} onCheckedChange={(v) => setOpts({ ...opts, symbols: v })} />
          </label>
          <label className="flex items-center gap-2 text-sm">
            去掉易混淆字符
            <Switch checked={opts.noAmbiguous} onCheckedChange={(v) => setOpts({ ...opts, noAmbiguous: v })} />
          </label>
        </div>

        <div className="bg-muted/40 mb-4 flex items-center gap-3 rounded-lg p-3">
          <div className="flex-1">
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">熵值约 {p ? bits : 0} bit</span>
              <span className="font-medium">{p ? s.label : '未选择字符集'}</span>
            </div>
            <div className="bg-background h-1.5 overflow-hidden rounded-full">
              <div className={`h-full rounded-full transition-all ${p ? s.cls : ''}`} style={{ width: p ? `${Math.min(100, bits / 1.4)}%` : '0%' }} />
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={regenerate} disabled={!p}>
            <RefreshCw />
            重新生成
          </Button>
          <CopyButton text={list[0] ?? ''} label="复制第一个" />
        </div>

        <div className="space-y-1">
          {list.map((pwd, i) => (
            <div key={i} className="bg-muted/30 flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
              <code className="text-sm break-all">{pwd}</code>
              <CopyButton text={pwd} label="" />
            </div>
          ))}
        </div>
      </div>
    </ToolShell>
  )
}
