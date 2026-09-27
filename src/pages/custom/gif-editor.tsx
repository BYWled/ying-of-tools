import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Play, RotateCcw, Sparkles, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { DropZone } from '@/components/converter/drop-zone'
import { decodeGifFrames, type GifFrame } from '@/engines/gif-tools'
import { GIFEncoder, quantize, applyPalette } from 'gifenc'
import { baseName, downloadBlob, formatBytes } from '@/lib/utils'

export default function GifEditorPage() {
  const [file, setFile] = useState<File | null>(null)
  const [frames, setFrames] = useState<GifFrame[]>([])
  const [removed, setRemoved] = useState<Set<number>>(new Set())
  const [width, setWidth] = useState(0) // 0 = 原始宽度
  const [speed, setSpeed] = useState(1)
  const [colors, setColors] = useState(256)
  const [busy, setBusy] = useState(false)
  const [outSize, setOutSize] = useState<number | null>(null)
  const [error, setError] = useState('')

  const previewRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef(0)
  const frameIdx = useRef(0)
  const nextAt = useRef(0)

  const thumbs = useMemo(
    () =>
      frames.map((f) => {
        const c = document.createElement('canvas')
        c.width = f.imageData.width
        c.height = f.imageData.height
        c.getContext('2d')!.putImageData(f.imageData, 0, 0)
        return c.toDataURL('image/png')
      }),
    [frames],
  )

  const activeFrames = frames.filter((_, i) => !removed.has(i))

  const load = async (f: File) => {
    setBusy(true)
    setError('')
    setOutSize(null)
    try {
      const { frames: fr } = await decodeGifFrames(f)
      setFrames(fr)
      setRemoved(new Set())
      setWidth(fr[0]?.imageData.width ?? 0)
      setFile(f)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  // 预览动画
  useEffect(() => {
    if (!frames.length || !previewRef.current) return
    const canvas = previewRef.current
    const ctx = canvas.getContext('2d')!
    canvas.width = frames[0].imageData.width
    canvas.height = frames[0].imageData.height
    const tick = (t: number) => {
      const active = frames.filter((_, i) => !removed.has(i))
      if (active.length) {
        if (t >= nextAt.current) {
          const f = active[frameIdx.current % active.length]
          ctx.putImageData(f.imageData, 0, 0)
          nextAt.current = t + Math.max(16, f.delay / speed)
          frameIdx.current++
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [frames, removed, speed])

  const generate = async () => {
    if (!activeFrames.length || !file) return
    setBusy(true)
    setError('')
    try {
      const scale = width > 0 && width !== frames[0].imageData.width ? width / frames[0].imageData.width : 1
      const w = Math.max(1, Math.round(frames[0].imageData.width * scale))
      const h = Math.max(1, Math.round(frames[0].imageData.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!

      const gif = GIFEncoder()
      activeFrames.forEach((f, i) => {
        ctx.clearRect(0, 0, w, h)
        ctx.drawImage(
          (() => {
            const tmp = document.createElement('canvas')
            tmp.width = f.imageData.width
            tmp.height = f.imageData.height
            tmp.getContext('2d')!.putImageData(f.imageData, 0, 0)
            return tmp
          })(),
          0,
          0,
          w,
          h,
        )
        const { data } = ctx.getImageData(0, 0, w, h)
        const palette = quantize(data, colors)
        const index = applyPalette(data, palette)
        gif.writeFrame(index, w, h, {
          palette,
          delay: Math.max(16, Math.round(f.delay / speed)),
          repeat: 0,
          first: i === 0,
        })
      })
      gif.finish()
      const blob = new Blob([gif.bytes() as unknown as BlobPart], { type: 'image/gif' })
      setOutSize(blob.size)
      downloadBlob(blob, `${baseName(file.name)}-编辑.gif`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  if (!file) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="font-heading text-2xl font-semibold md:text-3xl">GIF 编辑器</h1>
          <p className="text-muted-foreground mt-1">删除帧、变速、缩放、限制色数重新压缩——全程本地处理</p>
        </header>
        <DropZone accept="image/gif" onFiles={(fs) => load(fs[0])} hint="选择一个 GIF 文件" />
        {busy && (
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" />
            正在解析帧…
          </p>
        )}
        {error && <p className="text-destructive text-sm">{error}</p>}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold md:text-3xl">GIF 编辑器</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {file.name} · {frames.length} 帧 · {formatBytes(file.size)}
            {outSize !== null && ` → 输出 ${formatBytes(outSize)}`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setFile(null)}>
          换一个
        </Button>
      </header>

      <div className="grid items-start gap-4 lg:grid-cols-[280px_1fr]">
        {/* 预览 + 参数 */}
        <div className="space-y-4">
          <div className="bg-card rounded-2xl border p-3">
            <canvas ref={previewRef} className="w-full rounded-lg" />
            <p className="text-muted-foreground mt-2 flex items-center gap-1 text-xs">
              <Play className="size-3" />
              实时预览（{activeFrames.length} 帧 · {speed.toFixed(2)}x）
            </p>
          </div>

          <div className="bg-card space-y-4 rounded-2xl border p-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>速度倍率</Label>
                <span className="text-muted-foreground font-mono text-xs">{speed.toFixed(2)}x</span>
              </div>
              <Slider value={[speed]} min={0.25} max={4} step={0.05} onValueChange={([v]) => setSpeed(v)} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>输出宽度</Label>
                <span className="text-muted-foreground font-mono text-xs">
                  {width === frames[0]?.imageData.width ? '原始' : `${width} px`}
                </span>
              </div>
              <Slider
                value={[width]}
                min={80}
                max={frames[0]?.imageData.width ?? 800}
                step={20}
                onValueChange={([v]) => setWidth(v)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>调色板颜色数</Label>
              <div className="flex gap-2">
                {[256, 128, 64, 32].map((c) => (
                  <Button
                    key={c}
                    size="sm"
                    variant={colors === c ? 'default' : 'outline'}
                    className="flex-1 rounded-full"
                    onClick={() => setColors(c)}
                  >
                    {c}
                  </Button>
                ))}
              </div>
              <p className="text-muted-foreground text-xs">色数越少体积越小</p>
            </div>

            <Button className="w-full" onClick={generate} disabled={busy || !activeFrames.length}>
              {busy ? <Loader2 className="animate-spin" /> : <Sparkles />}
              生成并下载 GIF
            </Button>
            {outSize !== null && (
              <Badge variant="success" className="w-full justify-center py-1">
                输出 {formatBytes(outSize)}（原 {formatBytes(file.size)}）
              </Badge>
            )}
          </div>
        </div>

        {/* 帧条 */}
        <div className="bg-card rounded-2xl border p-3">
          <div className="mb-2 flex items-center justify-between">
            <Label>
              帧列表（点击移除 / 恢复，已移除 {removed.size} 帧）
            </Label>
            <Button variant="ghost" size="sm" onClick={() => setRemoved(new Set())}>
              <RotateCcw />
              全部恢复
            </Button>
          </div>
          <div className="grid max-h-[60vh] grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-6 md:grid-cols-8">
            {thumbs.map((src, i) => {
              const gone = removed.has(i)
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() =>
                    setRemoved((prev) => {
                      const next = new Set(prev)
                      if (next.has(i)) next.delete(i)
                      else next.add(i)
                      return next
                    })
                  }
                  className={`relative overflow-hidden rounded-lg border-2 transition-all ${
                    gone ? 'opacity-30 grayscale' : 'border-transparent hover:border-primary/50'
                  }`}
                  title={`第 ${i + 1} 帧 · ${frames[i].delay}ms`}
                >
                  <img src={src} alt={`第 ${i + 1} 帧`} className="aspect-square w-full object-cover" />
                  <span className="bg-background/80 absolute bottom-0 left-0 rounded-tr-md px-1 text-[10px]">
                    {i + 1}
                  </span>
                  {gone && (
                    <span className="text-destructive absolute inset-0 flex items-center justify-center">
                      <X className="size-5" />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  )
}
