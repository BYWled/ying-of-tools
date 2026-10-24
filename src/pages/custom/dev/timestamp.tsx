import { useEffect, useState } from 'react'
import { ArrowRight, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CopyButton, FieldRow, ResultCard, ToolShell } from '@/components/tool-shell'

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function fmtLocal(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function fmtUTC(ms: number): string {
  const d = new Date(ms)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`
}

function fmtISO(ms: number): string {
  return new Date(ms).toISOString()
}

function relative(ms: number): string {
  const diff = ms - Date.now()
  const abs = Math.abs(diff)
  const units: [number, string][] = [
    [31536000000, '年'],
    [2592000000, '个月'],
    [604800000, '周'],
    [86400000, '天'],
    [3600000, '小时'],
    [60000, '分钟'],
    [1000, '秒'],
  ]
  for (const [u, name] of units) {
    if (abs >= u) {
      const v = Math.floor(abs / u)
      return diff > 0 ? `${v} ${name}后` : `${v} ${name}前`
    }
  }
  return '刚刚'
}

function weekDay(ms: number) {
  return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][new Date(ms).getDay()]
}

export default function TimestampPage() {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  // 时间戳 → 日期
  const [tsInput, setTsInput] = useState(String(Math.floor(Date.now() / 1000)))
  const tsNum = Number(tsInput.trim())
  const tsValid = Number.isFinite(tsNum) && tsInput.trim() !== '' && tsNum > 0
  const tsMs = tsValid ? (tsNum > 1e12 ? tsNum : tsNum * 1000) : NaN

  // 日期 → 时间戳
  const [dateInput, setDateInput] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  })
  const dateMs = new Date(dateInput).getTime()
  const dateValid = Number.isFinite(dateMs)

  return (
    <ToolShell
      title="时间戳转换"
      desc="Unix 时间戳与日期时间双向转换，支持秒 / 毫秒自动识别、本地 / UTC / ISO 多种格式"
    >
      <div className="bg-primary/5 border-primary/20 rounded-xl border p-4">
        <div className="flex items-center gap-2 text-sm">
          <Clock className="text-primary size-4" />
          当前时间（每秒刷新）
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <ResultCard label="秒级时间戳" value={String(Math.floor(now / 1000))} />
          <ResultCard label="毫秒时间戳" value={String(now)} />
        </div>
        <p className="text-muted-foreground mt-2 text-xs">
          {fmtLocal(now)} · {weekDay(now)}
        </p>
      </div>

      <div className="rounded-xl border p-4">
        <FieldRow label="时间戳 → 日期" hint="10 位按秒、13 位按毫秒自动识别">
          <div className="flex gap-2">
            <Input
              value={tsInput}
              onChange={(e) => setTsInput(e.target.value)}
              placeholder="如 1761139200 或 1761139200000"
              className="font-mono"
            />
            <Button variant="outline" onClick={() => setTsInput(String(Math.floor(Date.now() / 1000)))}>
              此刻
            </Button>
          </div>
        </FieldRow>
        {tsValid ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <ResultCard label="本地时间" value={`${fmtLocal(tsMs)} ${weekDay(tsMs)}`} mono={false} />
            <ResultCard label="UTC 时间" value={fmtUTC(tsMs)} />
            <ResultCard label="ISO 8601" value={fmtISO(tsMs)} />
            <ResultCard label="相对现在" value={relative(tsMs)} mono={false} />
          </div>
        ) : (
          tsInput && <p className="text-destructive mt-2 text-sm">不是有效的时间戳数字</p>
        )}
      </div>

      <div className="rounded-xl border p-4">
        <FieldRow label="日期 → 时间戳">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="datetime-local"
              step={1}
              value={dateInput}
              onChange={(e) => setDateInput(e.target.value)}
              className="font-mono"
            />
            <ArrowRight className="text-muted-foreground size-4" />
            {dateValid ? (
              <div className="flex gap-2 font-mono text-sm">
                <code className="bg-muted rounded px-2 py-1">{Math.floor(dateMs / 1000)}</code>
                <code className="bg-muted rounded px-2 py-1">{dateMs}</code>
                <CopyButton text={String(Math.floor(dateMs / 1000))} />
              </div>
            ) : (
              <span className="text-destructive text-sm">日期无效</span>
            )}
          </div>
        </FieldRow>
      </div>
    </ToolShell>
  )
}
