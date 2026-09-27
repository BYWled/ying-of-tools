import { useState } from 'react'
import FilerobotImageEditor, { TABS } from 'react-filerobot-image-editor'
import { Download, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropZone } from '@/components/converter/drop-zone'

interface Source {
  url: string
  name: string
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, b64] = dataUrl.split(',')
  const mime = meta.match(/:(.*?);/)?.[1] ?? 'image/png'
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

export default function ImageEditorPage() {
  const [source, setSource] = useState<Source | null>(null)
  const [savedMsg, setSavedMsg] = useState('')

  const onFiles = (files: File[]) => {
    const file = files[0]
    if (!file) return
    setSource((prev) => {
      if (prev) URL.revokeObjectURL(prev.url)
      return { url: URL.createObjectURL(file), name: file.name }
    })
    setSavedMsg('')
  }

  const reset = () => {
    setSource((prev) => {
      if (prev) URL.revokeObjectURL(prev.url)
      return null
    })
  }

  if (!source) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="font-heading text-2xl font-semibold md:text-3xl">图片编辑器</h1>
          <p className="text-muted-foreground mt-1">裁剪、旋转、翻转、滤镜调色、加文字与标注，编辑完另存为 PNG / JPG / WebP</p>
        </header>
        <DropZone accept="image/*" onFiles={onFiles} hint="选择一张图片开始编辑，支持粘贴" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold md:text-3xl">图片编辑器</h1>
          <p className="text-muted-foreground mt-1 truncate text-sm">{source.name}</p>
        </div>
        <Button variant="outline" size="sm" onClick={reset}>
          <RotateCcw />
          换一张
        </Button>
      </header>

      {savedMsg && (
        <p className="text-success flex items-center gap-1.5 text-sm">
          <Download className="size-4" />
          {savedMsg}
        </p>
      )}

      <div className="bg-card h-[70vh] min-h-[480px] overflow-hidden rounded-2xl border">
        <FilerobotImageEditor
          source={source.url}
          savingPixelRatio={1}
          previewPixelRatio={1}
          defaultSavedImageName={source.name.replace(/\.[^.]+$/, '')}
          defaultSavedImageType="png"
          defaultTabId={TABS.ADJUST}
          tabsIds={[TABS.ADJUST, TABS.FINETUNE, TABS.FILTERS, TABS.RESIZE, TABS.ANNOTATE]}
          onSave={async (info) => {
            const edited = (info as { editedImageBase64?: string }).editedImageBase64
            const name = (info as { imageName?: string }).imageName ?? source.name
            if (edited) {
              const blob = dataUrlToBlob(edited)
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = name
              a.click()
              setTimeout(() => URL.revokeObjectURL(url), 10_000)
              setSavedMsg(`已保存 ${name}（${(blob.size / 1024).toFixed(0)} KB）`)
            }
            return false
          }}
        />
      </div>
      <p className="text-muted-foreground text-xs">
        保存后文件直接从浏览器下载，全程不经任何服务器。
      </p>
    </div>
  )
}
