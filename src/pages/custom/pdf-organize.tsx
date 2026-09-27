import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeftRight, Download, Loader2, RotateCcw, RotateCw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropZone } from '@/components/converter/drop-zone'
import { loadPdf } from '@/engines/pdf'
import { PDFDocument, degrees } from 'pdf-lib'
import { baseName, downloadBlob, formatBytes } from '@/lib/utils'

interface OrganizePage {
  id: number
  thumb: string
  rotation: number // 附加旋转角度（叠加在原 rotation 之上）
  selected: boolean
}

export default function PdfOrganizePage() {
  const [file, setFile] = useState<File | null>(null)
  const [pages, setPages] = useState<OrganizePage[]>([])
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const dragFrom = useRef<number | null>(null)

  const loadFile = useCallback(async (f: File) => {
    setLoading(true)
    try {
      const doc = await loadPdf(f)
      const next: OrganizePage[] = []
      for (let i = 1; i <= doc.numPages; i++) {
        const { blob } = await loadPdfRender(doc, i)
        next.push({ id: i, thumb: URL.createObjectURL(blob), rotation: 0, selected: false })
      }
      setPages(next)
      setFile(f)
    } catch (e) {
      alert(`PDF 加载失败：${e instanceof Error ? e.message : e}`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    return () => pages.forEach((p) => URL.revokeObjectURL(p.thumb))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleSelect = (id: number) =>
    setPages((ps) => ps.map((p) => (p.id === id ? { ...p, selected: !p.selected } : p)))

  const rotate = (dir: 1 | -1) =>
    setPages((ps) =>
      ps.map((p) => (p.selected ? { ...p, rotation: (p.rotation + dir * 90 + 360) % 360 } : p)),
    )

  const removeSelected = () => {
    setPages((ps) => {
      ps.filter((p) => p.selected).forEach((p) => URL.revokeObjectURL(p.thumb))
      return ps.filter((p) => !p.selected).map((p) => ({ ...p, selected: false }))
    })
  }

  const selectAll = (v: boolean) => setPages((ps) => ps.map((p) => ({ ...p, selected: v })))

  const onDropReorder = (to: number) => {
    const from = dragFrom.current
    dragFrom.current = null
    if (from === null || from === to) return
    setPages((ps) => {
      const next = [...ps]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }

  const apply = async () => {
    if (!file || !pages.length) return
    setApplying(true)
    try {
      const src = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true })
      const out = await PDFDocument.create()
      const copied = await out.copyPages(
        src,
        pages.map((p) => p.id - 1),
      )
      copied.forEach((page, i) => {
        const extra = pages[i].rotation
        if (extra) {
          const orig = page.getRotation().angle
          page.setRotation(degrees((orig + extra + 360) % 360))
        }
        out.addPage(page)
      })
      const bytes = await out.save()
      downloadBlob(
        new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' }),
        `${baseName(file.name)}-整理.pdf`,
      )
    } catch (e) {
      alert(`生成失败：${e instanceof Error ? e.message : e}`)
    } finally {
      setApplying(false)
    }
  }

  if (!file) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="font-heading text-2xl font-semibold md:text-3xl">PDF 页面整理</h1>
          <p className="text-muted-foreground mt-1">缩略图网格中拖拽排序，点选后旋转、删除页面，一键生成新 PDF</p>
        </header>
        <DropZone accept="application/pdf" onFiles={(fs) => loadFile(fs[0])} hint="选择一个 PDF 文件" />
        {loading && (
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" />
            正在渲染页面缩略图…
          </p>
        )}
      </div>
    )
  }

  const selectedCount = pages.filter((p) => p.selected).length

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold md:text-3xl">PDF 页面整理</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {file.name} · {formatBytes(file.size)} · 共 {pages.length} 页
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            pages.forEach((p) => URL.revokeObjectURL(p.thumb))
            setFile(null)
            setPages([])
          }}
        >
          换一个文件
        </Button>
      </header>

      <div className="bg-card flex flex-wrap items-center gap-2 rounded-2xl border p-3">
        <span className="text-muted-foreground mr-2 text-sm">已选 {selectedCount} 页</span>
        <Button size="sm" variant="secondary" disabled={!selectedCount} onClick={() => rotate(1)}>
          <RotateCw />
          右转 90°
        </Button>
        <Button size="sm" variant="secondary" disabled={!selectedCount} onClick={() => rotate(-1)}>
          <RotateCcw />
          左转 90°
        </Button>
        <Button size="sm" variant="destructive" disabled={!selectedCount} onClick={removeSelected}>
          <Trash2 />
          删除
        </Button>
        <Button size="sm" variant="ghost" onClick={() => selectAll(true)}>
          全选
        </Button>
        <Button size="sm" variant="ghost" onClick={() => selectAll(false)}>
          取消全选
        </Button>
        <span className="grow" />
        <Button onClick={apply} disabled={applying || !pages.length}>
          {applying ? <Loader2 className="animate-spin" /> : <Download />}
          生成新 PDF
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {pages.map((p, idx) => (
          <div
            key={p.id}
            draggable
            onDragStart={() => (dragFrom.current = idx)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => onDropReorder(idx)}
            onClick={() => toggleSelect(p.id)}
            className={`group relative cursor-grab rounded-xl border-2 bg-card p-2 transition-all active:cursor-grabbing ${
              p.selected ? 'border-primary shadow-md' : 'border-transparent hover:border-border'
            }`}
          >
            <div className="flex items-center justify-center">
              <img
                src={p.thumb}
                alt={`第 ${p.id} 页`}
                className="max-h-52 rounded-md object-contain shadow-sm transition-transform"
                style={{ transform: `rotate(${p.rotation}deg)` }}
              />
            </div>
            <div className="text-muted-foreground mt-2 flex items-center justify-between text-xs">
              <span>第 {p.id} 页</span>
              {p.rotation !== 0 && (
                <span className="text-primary flex items-center gap-0.5">
                  <ArrowLeftRight className="size-3" />
                  {p.rotation}°
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** 缩略图专用低 DPI 渲染 */
async function loadPdfRender(doc: Awaited<ReturnType<typeof loadPdf>>, page: number) {
  const { renderPageToBlob } = await import('@/engines/pdf')
  return renderPageToBlob(doc, page, { dpi: 45, type: 'image/png' })
}
