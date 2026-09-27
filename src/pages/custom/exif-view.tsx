import { useState } from 'react'
import exifr from 'exifr'
import { Download, Loader2, PackageOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DropZone } from '@/components/converter/drop-zone'
import { decodeImage } from '@/engines/image'
import { baseName, downloadBlob, formatBytes } from '@/lib/utils'
import { zipResults } from '@/lib/zip'
import type { ResultFile } from '@/config/types'

interface Entry {
  file: File
  info: Record<string, unknown> | null
  error?: string
}

const FIELD_LABELS: [string, string][] = [
  ['Make', '相机品牌'],
  ['Model', '相机型号'],
  ['LensModel', '镜头'],
  ['DateTimeOriginal', '拍摄时间'],
  ['ExposureTime', '曝光时间'],
  ['FNumber', '光圈'],
  ['ISO', 'ISO'],
  ['FocalLength', '焦距'],
  ['Software', '处理软件'],
  ['latitude', '纬度'],
  ['longitude', '经度'],
]

function fmt(key: string, v: unknown): string {
  if (v == null) return '—'
  if (key === 'ExposureTime' && typeof v === 'number') return v < 1 ? `1/${Math.round(1 / v)} s` : `${v} s`
  if (key === 'FNumber' && typeof v === 'number') return `f/${v}`
  if (key === 'FocalLength' && typeof v === 'number') return `${v} mm`
  if (key === 'DateTimeOriginal') return new Date(v as string).toLocaleString('zh-CN')
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(6)
  return String(v)
}

export default function ExifViewPage() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [active, setActive] = useState(0)
  const [busy, setBusy] = useState(false)

  const addFiles = async (files: File[]) => {
    const parsed: Entry[] = []
    for (const file of files) {
      try {
        const info = await exifr.parse(file, { gps: true })
        parsed.push({ file, info: (info as Record<string, unknown>) ?? null })
      } catch {
        parsed.push({ file, info: null, error: '未找到 EXIF 信息（可能已被清除或不含元数据）' })
      }
    }
    setEntries((prev) => [...prev, ...parsed])
    setActive(0)
  }

  const stripOne = async (entry: Entry) => {
    const bitmap = await decodeImage(entry.file)
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0)
    bitmap.close()
    const isPng = entry.file.type === 'image/png'
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('编码失败'))),
        isPng ? 'image/png' : 'image/jpeg',
        0.92,
      ),
    )
    const ext = isPng ? 'png' : 'jpg'
    downloadBlob(blob, `${baseName(entry.file.name)}-已清除.${ext}`)
  }

  const stripAll = async () => {
    setBusy(true)
    try {
      const results: ResultFile[] = []
      for (const entry of entries) {
        const bitmap = await decodeImage(entry.file)
        const canvas = document.createElement('canvas')
        canvas.width = bitmap.width
        canvas.height = bitmap.height
        canvas.getContext('2d')!.drawImage(bitmap, 0, 0)
        bitmap.close()
        const isPng = entry.file.type === 'image/png'
        const blob = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob(
            (b) => (b ? resolve(b) : reject(new Error('编码失败'))),
            isPng ? 'image/png' : 'image/jpeg',
            0.92,
          ),
        )
        const ext = isPng ? 'png' : 'jpg'
        results.push({ name: `${baseName(entry.file.name)}-已清除.${ext}`, blob })
      }
      await zipResults(results, '已清除EXIF.zip')
    } finally {
      setBusy(false)
    }
  }

  const current = entries[active]
  const info = current?.info

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-heading text-2xl font-semibold md:text-3xl">EXIF 查看 / 清除</h1>
        <p className="text-muted-foreground mt-1">
          读取照片拍摄参数与 GPS 位置；发图前可抹除全部隐私元数据后导出
        </p>
      </header>

      <DropZone accept="image/*" multiple onFiles={addFiles} compact={entries.length > 0} />

      {entries.length > 0 && (
        <div className="grid items-start gap-4 lg:grid-cols-[300px_1fr]">
          <div className="space-y-2">
            {entries.map((e, i) => (
              <button
                key={`${e.file.name}-${i}`}
                type="button"
                onClick={() => setActive(i)}
                className={`flex w-full items-center gap-3 rounded-xl border p-2 text-left transition-colors ${
                  i === active ? 'border-primary bg-primary/5' : 'bg-card hover:border-border'
                }`}
              >
                <img
                  src={URL.createObjectURL(e.file)}
                  alt=""
                  className="bg-muted size-12 shrink-0 rounded-lg object-cover"
                  onLoad={(ev) => {
                    // 仅展示用，加载后释放
                    const url = (ev.target as HTMLImageElement).src
                    setTimeout(() => URL.revokeObjectURL(url), 1000)
                  }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{e.file.name}</span>
                  <span className="text-muted-foreground block text-xs">{formatBytes(e.file.size)}</span>
                </span>
              </button>
            ))}
            <Button variant="secondary" className="w-full" onClick={stripAll} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <PackageOpen />}
              全部清除并打包下载
            </Button>
          </div>

          {current && (
            <Card className="p-5">
              {current.error ? (
                <p className="text-muted-foreground text-sm">{current.error}</p>
              ) : info ? (
                <>
                  <div className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
                    {FIELD_LABELS.map(([key, label]) => {
                      const v = info[key]
                      return (
                        <div key={key} className="flex items-baseline justify-between gap-4 border-b border-dashed py-1.5">
                          <span className="text-muted-foreground text-sm">{label}</span>
                          <span className="text-right font-mono text-sm">
                            {key === 'latitude' && info.longitude && typeof info.latitude === 'number' ? (
                              <a
                                className="text-primary underline-offset-2 hover:underline"
                                href={`https://www.openstreetmap.org/?mlat=${info.latitude}&mlon=${info.longitude}#map=16/${info.latitude}/${info.longitude}`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {fmt(key, v)}
                              </a>
                            ) : (
                              fmt(key, v)
                            )}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                  <Button variant="outline" size="sm" className="mt-4" onClick={() => stripOne(current)}>
                    <Download />
                    清除元数据并下载
                  </Button>
                </>
              ) : (
                <p className="text-muted-foreground text-sm">未找到 EXIF 信息</p>
              )}
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
