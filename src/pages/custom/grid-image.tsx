import { useState } from 'react'
import { Download, Grid3x3, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SimpleSelect } from '@/components/ui/select'
import { DropZone } from '@/components/converter/drop-zone'
import { ToolShell } from '@/components/tool-shell'
import { zipResults } from '@/lib/zip'

export default function GridImagePage() {
  const [file, setFile] = useState<File | null>(null)
  const [url, setUrl] = useState('')
  const [tiles, setTiles] = useState<{ url: string; name: string; blob: Blob }[]>([])
  const [busy, setBusy] = useState(false)
  const [rows, setRows] = useState('3')
  const [cols, setCols] = useState('3')

  const onFiles = async (files: File[]) => {
    const f = files[0]
    if (!f) return
    setFile(f)
    if (url) URL.revokeObjectURL(url)
    setUrl(URL.createObjectURL(f))
    setTiles([])
  }

  const slice = async () => {
    if (!file) return
    setBusy(true)
    try {
      const bitmap = await createImageBitmap(file)
      const r = Number(rows)
      const c = Number(cols)
      const tileW = Math.floor(bitmap.width / c)
      const tileH = Math.floor(bitmap.height / r)
      const canvas = document.createElement('canvas')
      canvas.width = tileW
      canvas.height = tileH
      const ctx = canvas.getContext('2d')!
      const out: { url: string; name: string; blob: Blob }[] = []
      for (let y = 0; y < r; y++) {
        for (let x = 0; x < c; x++) {
          ctx.clearRect(0, 0, tileW, tileH)
          ctx.drawImage(bitmap, x * tileW, y * tileH, tileW, tileH, 0, 0, tileW, tileH)
          const blob = await new Promise<Blob>((res, rej) =>
            canvas.toBlob((b) => (b ? res(b) : rej(new Error('切片渲染失败'))), 'image/png'),
          )
          out.push({
            url: URL.createObjectURL(blob),
            name: `第${y + 1}行第${x + 1}列.png`,
            blob,
          })
        }
      }
      bitmap.close()
      setTiles(out)
    } finally {
      setBusy(false)
    }
  }

  return (
    <ToolShell
      title="图片九宫格切图"
      desc="把一张图片均匀切成 3×3（或自定义行列）小块，发朋友圈九宫格必备，打包下载"
    >
      {!file && <DropZone accept="image/*" multiple={false} onFiles={onFiles} hint="选择一张接近正方形的图片效果最佳" />}

      {file && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3 rounded-xl border p-4">
            <div className="w-32 space-y-1.5">
              <span className="text-muted-foreground text-xs font-medium">行数</span>
              <SimpleSelect value={rows} onChange={setRows} options={[2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n} 行` }))} />
            </div>
            <div className="w-32 space-y-1.5">
              <span className="text-muted-foreground text-xs font-medium">列数</span>
              <SimpleSelect value={cols} onChange={setCols} options={[2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n} 列` }))} />
            </div>
            <Button onClick={() => void slice()} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <Grid3x3 />}
              开始切图
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setFile(null)
                if (url) URL.revokeObjectURL(url)
                setUrl('')
                setTiles([])
              }}
            >
              换一张
            </Button>
          </div>

          {url && (
            <div className="space-y-1.5">
              <span className="text-muted-foreground text-xs font-medium">原图</span>
              <img src={url} alt="原图预览" className="max-h-64 rounded-xl border" />
            </div>
          )}

          {tiles.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs font-medium">切片预览（{tiles.length} 张）</span>
                <Button variant="secondary" size="sm" onClick={() => zipResults(tiles, '九宫格切图.zip')}>
                  <Download />
                  打包下载
                </Button>
              </div>
              <div
                className="grid gap-1.5"
                style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, maxWidth: 480 }}
              >
                {tiles.map((t, i) => (
                  <img key={i} src={t.url} alt={t.name} className="aspect-square w-full rounded border object-cover" />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </ToolShell>
  )
}
