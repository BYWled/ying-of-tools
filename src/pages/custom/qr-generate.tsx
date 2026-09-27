import { useEffect, useRef, useState } from 'react'
import { Download, FileCode2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { SimpleSelect } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { downloadBlob } from '@/lib/utils'

export default function QrGeneratePage() {
  const [text, setText] = useState('https://example.com')
  const [size, setSize] = useState(512)
  const [margin, setMargin] = useState(2)
  const [ecc, setEcc] = useState('M')
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const svgRef = useRef<string>('')

  useEffect(() => {
    let cancelled = false
    const render = async () => {
      if (!text.trim()) {
        setReady(false)
        setError('')
        return
      }
      try {
        const QRCode = await import('qrcode')
        const canvas = canvasRef.current
        if (!canvas) return
        await QRCode.toCanvas(canvas, text, {
          width: size,
          margin,
          errorCorrectionLevel: ecc as 'L' | 'M' | 'Q' | 'H',
          color: { dark: '#0d1f1d', light: '#ffffff' },
        })
        svgRef.current = await QRCode.toString(text, {
          type: 'svg',
          width: size,
          margin,
          errorCorrectionLevel: ecc as 'L' | 'M' | 'Q' | 'H',
          color: { dark: '#0d1f1d', light: '#ffffff' },
        })
        setError('')
        setReady(true)
      } catch (e) {
        setReady(false)
        setError(e instanceof Error ? e.message : '生成失败，内容可能过长')
      }
      if (cancelled) return
    }
    const timer = setTimeout(render, 150)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [text, size, margin, ecc])

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-heading text-2xl font-semibold md:text-3xl">二维码生成</h1>
        <p className="text-muted-foreground mt-1">输入文本或链接，实时生成二维码，可下载 PNG / SVG</p>
      </header>

      <div className="grid items-start gap-6 md:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>内容（文本 / 链接 / WiFi 信息等）</Label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              className="border-input focus-visible:ring-ring/50 w-full rounded-md border bg-transparent px-3 py-2 font-mono text-sm outline-none focus-visible:ring-[3px]"
              placeholder="例如：https://example.com 或任意文本"
            />
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
        </div>

        <div className="space-y-4">
          <div className="bg-card flex flex-col items-center gap-4 rounded-2xl border p-5">
            <div className="bg-white p-2 rounded-xl max-w-full overflow-hidden">
              <canvas ref={canvasRef} className="max-w-full h-auto" />
            </div>
            <div className="flex w-full gap-2">
              <Button
                className="flex-1"
                disabled={!ready}
                onClick={() => {
                  canvasRef.current?.toBlob((b) => {
                    if (b) downloadBlob(b, '二维码.png')
                  }, 'image/png')
                }}
              >
                <Download />
                PNG
              </Button>
              <Button
                variant="secondary"
                className="flex-1"
                disabled={!ready}
                onClick={() => downloadBlob(new Blob([svgRef.current], { type: 'image/svg+xml' }), '二维码.svg')}
              >
                <FileCode2 />
                SVG
              </Button>
            </div>
          </div>

          <div className="bg-card space-y-4 rounded-2xl border p-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>尺寸</Label>
                <span className="text-muted-foreground font-mono text-xs">{size} px</span>
              </div>
              <Slider value={[size]} min={128} max={1024} step={32} onValueChange={([v]) => setSize(v)} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>留白边距</Label>
                <span className="text-muted-foreground font-mono text-xs">{margin}</span>
              </div>
              <Slider value={[margin]} min={0} max={8} step={1} onValueChange={([v]) => setMargin(v)} />
            </div>
            <div className="space-y-1.5">
              <Label>纠错等级</Label>
              <SimpleSelect
                value={ecc}
                onChange={setEcc}
                options={[
                  { value: 'L', label: 'L · 7%（容量最大）' },
                  { value: 'M', label: 'M · 15%（推荐）' },
                  { value: 'Q', label: 'Q · 25%' },
                  { value: 'H', label: 'H · 30%（最抗遮挡）' },
                ]}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
