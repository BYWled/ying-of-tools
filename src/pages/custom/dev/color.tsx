import { useMemo, useState } from 'react'
import { CopyButton, ToolShell } from '@/components/tool-shell'

/* ───────── 色彩数学（无依赖） ───────── */

function hexToRgb(hex: string): [number, number, number] | null {
  const m = hex.trim().replace('#', '')
  const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)]
}

function rgbToHex(r: number, g: number, b: number): string {
  const h = (n: number) => Math.round(n).toString(16).padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max === g) h = ((b - r) / d + 2) / 6
  else h = ((r - g) / d + 4) / 6
  return [h * 360, s, l]
}

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const v = max
  const s = max === 0 ? 0 : (max - min) / max
  let h = 0
  if (max !== min) {
    const d = max - min
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
    else if (max === g) h = ((b - r) / d + 2) / 6
    else h = ((r - g) / d + 4) / 6
    h *= 360
  }
  return [h, s, v]
}

function rgbToCmyk(r: number, g: number, b: number): [number, number, number, number] {
  const rr = r / 255, gg = g / 255, bb = b / 255
  const k = 1 - Math.max(rr, gg, bb)
  if (k === 1) return [0, 0, 0, 1]
  const c = (1 - rr - k) / (1 - k)
  const m = (1 - gg - k) / (1 - k)
  const y = (1 - bb - k) / (1 - k)
  return [c, m, y, k]
}

/** WCAG 相对亮度 */
function luminance(r: number, g: number, b: number): number {
  const f = (v: number) => {
    v /= 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

function contrastRatio(rgb1: [number, number, number], rgb2: [number, number, number]): number {
  const l1 = luminance(...rgb1)
  const l2 = luminance(...rgb2)
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
}

const pct = (v: number) => `${Math.round(v * 100)}%`

export default function ColorPage() {
  const [hex, setHex] = useState('#1f8e83')
  const [textColor, setTextColor] = useState('#ffffff')

  const rgb = useMemo(() => hexToRgb(hex), [hex])
  const white = hexToRgb(textColor) ?? [255, 255, 255]

  const rows = useMemo(() => {
    if (!rgb) return []
    const [r, g, b] = rgb
    const [h, s, l] = rgbToHsl(r, g, b)
    const [hv, sv, vv] = rgbToHsv(r, g, b)
    const [c, m, y, k] = rgbToCmyk(r, g, b)
    return [
      { label: 'HEX', value: rgbToHex(r, g, b).toUpperCase() },
      { label: 'RGB', value: `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})` },
      { label: 'HSL', value: `hsl(${Math.round(h)}, ${pct(s)}, ${pct(l)})` },
      { label: 'HSV / HSB', value: `hsv(${Math.round(hv)}, ${pct(sv)}, ${pct(vv)})` },
      { label: 'CMYK', value: `${pct(c)}, ${pct(m)}, ${pct(y)}, ${pct(k)}` },
      { label: 'CSS 变量', value: `--color: ${rgbToHex(r, g, b)};` },
    ]
  }, [rgb])

  const ratio = rgb ? contrastRatio(rgb, white) : 0

  return (
    <ToolShell title="颜色转换器" desc="HEX / RGB / HSL / HSV / CMYK 互转，附 WCAG 对比度无障碍检查">
      <div className="rounded-xl border p-4">
        <div className="flex flex-wrap items-center gap-4">
          <input
            type="color"
            value={rgb ? hexToHex6(hex) : '#1f8e83'}
            onChange={(e) => setHex(e.target.value)}
            className="border-border size-16 cursor-pointer rounded-xl border"
            aria-label="选择颜色"
          />
          <div>
            <p className="text-sm font-medium">拾取或输入颜色</p>
            <p className="text-muted-foreground text-xs">支持 #fff / #1f8e83 格式</p>
          </div>
          <input
            value={hex}
            onChange={(e) => setHex(e.target.value)}
            className="border-input w-36 rounded-lg border bg-transparent px-3 py-2 font-mono text-sm outline-none focus:border-primary/50"
            placeholder="#1f8e83"
          />
        </div>

        {rgb ? (
          <>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {rows.map((r) => (
                <div key={r.label} className="bg-muted/40 flex items-center justify-between gap-2 rounded-lg border p-3">
                  <div>
                    <p className="text-muted-foreground text-xs">{r.label}</p>
                    <p className="font-mono text-sm">{r.value}</p>
                  </div>
                  <CopyButton text={r.value} label="" />
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-lg border p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">对比度检查（与文字色）</p>
                <input
                  value={textColor}
                  onChange={(e) => setTextColor(e.target.value)}
                  className="border-input w-28 rounded-lg border bg-transparent px-2 py-1 font-mono text-xs outline-none"
                />
              </div>
              <div
                className="rounded-lg p-4 text-center text-lg font-semibold"
                style={{ backgroundColor: hexToHex6(hex), color: textColor }}
              >
                对比文本示例 Aa 你好 123
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="bg-muted/40 rounded-lg border p-2 text-center">
                  <p className="font-mono text-lg font-semibold">{ratio.toFixed(2)}</p>
                  <p className="text-muted-foreground text-xs">比值</p>
                </div>
                {[
                  { name: 'AA 正文', need: 4.5 },
                  { name: 'AA 大字', need: 3 },
                  { name: 'AAA 正文', need: 7 },
                ].map((lvl) => (
                  <div key={lvl.name} className={`rounded-lg border p-2 text-center ${ratio >= lvl.need ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                    <p className={`text-lg font-semibold ${ratio >= lvl.need ? 'text-emerald-600' : 'text-red-500'}`}>
                      {ratio >= lvl.need ? '通过' : '未过'}
                    </p>
                    <p className="text-muted-foreground text-xs">{lvl.name} ≥{lvl.need}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <p className="text-destructive mt-3 text-sm">颜色格式无效，请输入 3 位或 6 位十六进制</p>
        )}
      </div>
    </ToolShell>
  )
}

function hexToHex6(hex: string): string {
  const m = hex.trim().replace('#', '')
  if (/^[0-9a-fA-F]{3}$/.test(m)) return '#' + m.split('').map((c) => c + c).join('')
  if (/^[0-9a-fA-F]{6}$/.test(m)) return '#' + m.toLowerCase()
  return '#1f8e83'
}
