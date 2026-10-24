import { useMemo, useState } from 'react'
import { SimpleSelect } from '@/components/ui/select'
import { ToolShell } from '@/components/tool-shell'

/** 各类别基准单位 → 目标单位 的换算系数（目标值 = 输入 × 系数 / 目标系数） */
const UNITS: Record<string, { name: string; base: string; units: Record<string, number> }> = {
  length: {
    name: '长度',
    base: '米 m',
    units: {
      '纳米 nm': 1e-9,
      '微米 µm': 1e-6,
      '毫米 mm': 1e-3,
      '厘米 cm': 1e-2,
      '米 m': 1,
      '千米 km': 1000,
      '英寸 in': 0.0254,
      '英尺 ft': 0.3048,
      '码 yd': 0.9144,
      '英里 mi': 1609.344,
      '里 (市制)': 500,
      '丈 (市制)': 10 / 3,
      '尺 (市制)': 1 / 3,
      '寸 (市制)': 1 / 30,
      '光年 ly': 9.4607e15,
    },
  },
  mass: {
    name: '重量',
    base: '千克 kg',
    units: {
      '毫克 mg': 1e-6,
      '克 g': 1e-3,
      '千克 kg': 1,
      '吨 t': 1000,
      '盎司 oz': 0.0283495231,
      '磅 lb': 0.45359237,
      '斤 (市制)': 0.5,
      '两 (市制)': 0.05,
      ' Stones st': 6.35029318,
    },
  },
  data: {
    name: '数据量',
    base: '字节 B',
    units: {
      'Bit bit': 1 / 8,
      '字节 B': 1,
      'KB (1024)': 1024,
      'MB (1024)': 1024 ** 2,
      'GB (1024)': 1024 ** 3,
      'TB (1024)': 1024 ** 4,
      'KB (1000)': 1e3,
      'MB (1000)': 1e6,
      'GB (1000)': 1e9,
      'TB (1000)': 1e12,
    },
  },
  area: {
    name: '面积',
    base: '平方米 m²',
    units: {
      '平方毫米 mm²': 1e-6,
      '平方厘米 cm²': 1e-4,
      '平方米 m²': 1,
      '平方千米 km²': 1e6,
      '公顷 ha': 1e4,
      '亩 (市制)': 2000 / 3,
      '平方英尺 ft²': 0.09290304,
      '平方英里 mi²': 2589988.110336,
    },
  },
  speed: {
    name: '速度',
    base: '米/秒 m/s',
    units: {
      '米/秒 m/s': 1,
      '千米/小时 km/h': 1 / 3.6,
      '英里/小时 mph': 0.44704,
      '节 kn': 0.514444,
      '马赫 Mach': 340.29,
    },
  },
  time: {
    name: '时间',
    base: '秒 s',
    units: {
      '毫秒 ms': 1e-3,
      '秒 s': 1,
      '分钟 min': 60,
      '小时 h': 3600,
      '天 d': 86400,
      '周 wk': 604800,
      '月 (30天)': 2592000,
      '年 (365天)': 31536000,
    },
  },
}

/** 温度特殊处理（非比例换算） */
function tempConvert(v: number, from: string, to: string): number {
  let c: number
  if (from.startsWith('摄氏')) c = v
  else if (from.startsWith('华氏')) c = ((v - 32) * 5) / 9
  else c = v - 273.15
  if (to.startsWith('摄氏')) return c
  if (to.startsWith('华氏')) return (c * 9) / 5 + 32
  return c + 273.15
}

const TEMPS = ['摄氏度 °C', '华氏度 °F', '开尔文 K']

function fmtNum(n: number): string {
  if (!Number.isFinite(n)) return '—'
  if (Math.abs(n) >= 1e15 || (Math.abs(n) < 1e-9 && n !== 0)) return n.toExponential(6)
  const s = n.toPrecision(12).replace(/\.?0+$/, '')
  return String(Number(s))
}

export default function UnitPage() {
  const [cat, setCat] = useState('length')
  const [value, setValue] = useState('1')
  const isTemp = cat === 'temp'
  const unitNames = isTemp ? TEMPS : Object.keys(UNITS[cat].units)
  const [from, setFrom] = useState(unitNames[4] ?? unitNames[0])
  const [to, setTo] = useState(unitNames[3] ?? unitNames[1])

  const cats = [...Object.entries(UNITS).map(([id, u]) => ({ value: id, label: u.name })), { value: 'temp', label: '温度' }]

  const onCatChange = (c: string) => {
    setCat(c)
    if (c === 'temp') {
      setFrom(TEMPS[0])
      setTo(TEMPS[1])
    } else {
      const names = Object.keys(UNITS[c].units)
      setFrom(names[Math.min(4, names.length - 1)])
      setTo(names[Math.min(3, names.length - 1)])
    }
  }

  const result = useMemo(() => {
    const v = Number(value.trim())
    if (!Number.isFinite(v) || value.trim() === '') return null
    if (isTemp) return tempConvert(v, from, to)
    const units = UNITS[cat].units
    return (v * (units[from] ?? 1)) / (units[to] ?? 1)
  }, [value, from, to, cat, isTemp])

  const allConversions = useMemo(() => {
    const v = Number(value.trim())
    if (!Number.isFinite(v) || value.trim() === '') return []
    if (isTemp) return TEMPS.map((t) => ({ unit: t, val: fmtNum(tempConvert(v, from, t)) }))
    const units = UNITS[cat].units
    return Object.entries(units).map(([name, f]) => ({
      unit: name,
      val: fmtNum((v * (units[from] ?? 1)) / f),
    }))
  }, [value, from, cat, isTemp])

  return (
    <ToolShell title="单位换算" desc="长度、重量、面积、体积、速度、时间、数据量与温度的常用单位互转">
      <div className="rounded-xl border p-4">
        <div className="grid gap-3 sm:grid-cols-[auto_1fr_1fr_1fr]">
          <div className="w-32 space-y-1.5">
            <span className="text-muted-foreground text-xs font-medium">类别</span>
            <SimpleSelect value={cat} onChange={onCatChange} options={cats} />
          </div>
          <div className="space-y-1.5">
            <span className="text-muted-foreground text-xs font-medium">数值</span>
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="border-input w-full rounded-lg border bg-transparent px-3 py-2 font-mono text-sm outline-none focus:border-primary/50"
              placeholder="输入数值"
            />
          </div>
          <div className="space-y-1.5">
            <span className="text-muted-foreground text-xs font-medium">从</span>
            <SimpleSelect value={from} onChange={setFrom} options={unitNames.map((u) => ({ value: u, label: u }))} />
          </div>
          <div className="space-y-1.5">
            <span className="text-muted-foreground text-xs font-medium">到</span>
            <SimpleSelect value={to} onChange={setTo} options={unitNames.map((u) => ({ value: u, label: u }))} />
          </div>
        </div>

        <div className="bg-primary/5 border-primary/20 mt-4 rounded-lg border p-4 text-center">
          <p className="font-mono text-2xl font-semibold break-all">
            {result === null ? '—' : `${fmtNum(result)} ${to.split(' ').pop()}`}
          </p>
        </div>

        {allConversions.length > 0 && (
          <div className="mt-4 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {allConversions.map((c) => (
              <div key={c.unit} className="bg-muted/40 flex items-center justify-between rounded-lg px-3 py-2 text-xs">
                <span className="text-muted-foreground">{c.unit}</span>
                <code className="font-mono">{c.val}</code>
              </div>
            ))}
          </div>
        )}
      </div>
    </ToolShell>
  )
}
