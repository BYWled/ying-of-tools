import { useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { SimpleSelect } from '@/components/ui/select'
import { ErrorText, ResultCard, ToolShell } from '@/components/tool-shell'

const RADICES: { value: string; label: string }[] = [
  { value: '2', label: '二进制 (2)' },
  { value: '8', label: '八进制 (8)' },
  { value: '10', label: '十进制 (10)' },
  { value: '16', label: '十六进制 (16)' },
  { value: '26', label: '二十六进制 (26)' },
  { value: '36', label: '三十六进制 (36)' },
]

export default function RadixPage() {
  const [value, setValue] = useState('255')
  const [from, setFrom] = useState('10')

interface ParsedOk {
  ok: true
  n: bigint
  unsigned: bigint
  negative: boolean
}
interface ParsedErr {
  ok: false
  msg: string
}

const parsed = useMemo<ParsedOk | ParsedErr>(() => {
  const v = value.trim().toLowerCase().replace(/^0[xbo]/, '')
  if (!v || !/^[0-9a-z]+$/.test(v)) return { ok: false, msg: '请输入有效的数字字符串' }
  const radix = Number(from)
  const n = parseInt(v, radix)
  if (!Number.isFinite(n) || !/^-?\d+$/.test(String(n))) return { ok: false, msg: '在该进制下无效' }
  for (const ch of v.replace('-', '')) {
    const digit = parseInt(ch, 36)
    if (digit >= radix || Number.isNaN(digit)) return { ok: false, msg: `字符「${ch}」超出 ${radix} 进制范围` }
  }
  return {
    ok: true,
    n: BigInt(n),
    unsigned: BigInt(Math.abs(n)),
    negative: n < 0,
  }
}, [value, from])

  const rows: { radix: number; label: string }[] = [
    { radix: 2, label: '二进制 BIN' },
    { radix: 8, label: '八进制 OCT' },
    { radix: 10, label: '十进制 DEC' },
    { radix: 16, label: '十六进制 HEX' },
    { radix: 26, label: '26 进制' },
    { radix: 36, label: '36 进制' },
  ]

  return (
    <ToolShell title="进制转换" desc="二进制 / 八进制 / 十进制 / 十六进制等 2-36 进制互转">
      <div className="rounded-xl border p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-48 flex-1 space-y-1.5">
            <span className="text-muted-foreground text-xs font-medium">输入数值</span>
            <Input value={value} onChange={(e) => setValue(e.target.value)} className="font-mono" placeholder="如 255 / 0xff / 1010" />
          </div>
          <div className="w-44 space-y-1.5">
            <span className="text-muted-foreground text-xs font-medium">输入进制</span>
            <SimpleSelect value={from} onChange={setFrom} options={RADICES} />
          </div>
        </div>
        {parsed.ok ? (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {rows.map((r) => (
              <ResultCard
                key={r.radix}
                label={r.label}
                value={parsed.negative ? `-${parsed.unsigned.toString(r.radix)}` : parsed.unsigned.toString(r.radix)}
              />
            ))}
            <ResultCard label="字节数（绝对值）" value={String(Math.ceil(parsed.unsigned.toString(2).length / 8))} />
          </div>
        ) : (
          <ErrorText>{parsed.msg}</ErrorText>
        )}
      </div>

      {parsed.ok && parsed.unsigned < 0x100000000n && (
        <div className="rounded-xl border p-4">
          <p className="mb-2 text-sm font-medium">位视图（32 位）</p>
          <div className="flex flex-wrap gap-[3px] font-mono text-xs">
            {Array.from({ length: 32 }, (_, i) => {
              const bit = (Number(parsed.unsigned) >> (31 - i)) & 1
              return (
                <span
                  key={i}
                  className={
                    bit
                      ? 'bg-primary/15 text-primary flex size-6 items-center justify-center rounded'
                      : 'bg-muted text-muted-foreground flex size-6 items-center justify-center rounded'
                  }
                >
                  {bit}
                </span>
              )
            })}
          </div>
        </div>
      )}
    </ToolShell>
  )
}
