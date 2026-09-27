import { useState } from 'react'
import {
  Check,
  ChevronDown,
  Copy,
  Download,
  File as FileIcon,
  FileAudio,
  FileImage,
  FileText,
  FileVideo,
  Loader2,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { copyText, downloadBlob, formatBytes } from '@/lib/utils'
import type { QueueItem } from '@/stores/queue'

function TypeIcon({ mime, className }: { mime: string; className?: string }) {
  const C = mime.startsWith('image/')
    ? FileImage
    : mime.startsWith('audio/')
      ? FileAudio
      : mime.startsWith('video/')
        ? FileVideo
        : mime.startsWith('text/')
          ? FileText
          : FileIcon
  return <C className={className} />
}

function StatusChip({ item }: { item: QueueItem }) {
  if (item.status === 'running')
    return (
      <Badge variant="secondary">
        <Loader2 className="animate-spin" /> 处理中
      </Badge>
    )
  if (item.status === 'done')
    return (
      <Badge variant="success">
        <Check /> 完成
      </Badge>
    )
  if (item.status === 'error')
    return (
      <Badge variant="destructive">
        <X /> 失败
      </Badge>
    )
  return <Badge variant="outline">等待中</Badge>
}

function TextPreview({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  return (
    <div className="mt-2">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => setOpen(!open)}>
          <ChevronDown className={open ? 'rotate-180 transition-transform' : 'transition-transform'} />
          查看内容
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            if (await copyText(text)) {
              setCopied(true)
              setTimeout(() => setCopied(false), 1500)
            }
          }}
        >
          {copied ? <Check /> : <Copy />}
          {copied ? '已复制' : '复制'}
        </Button>
      </div>
      {open && (
        <pre className="bg-muted/60 max-h-48 overflow-auto rounded-lg p-3 font-mono text-xs whitespace-pre-wrap">
          {text}
        </pre>
      )}
    </div>
  )
}

export function FileRow({ item, onRemove }: { item: QueueItem; onRemove: (id: string) => void }) {
  return (
    <div className="bg-card flex items-start gap-3 rounded-xl border p-3">
      {item.thumb ? (
        <img src={item.thumb} alt="" className="bg-muted size-12 shrink-0 rounded-lg object-cover" />
      ) : (
        <div className="bg-muted text-muted-foreground flex size-12 shrink-0 items-center justify-center rounded-lg">
          <TypeIcon mime={item.file.type} className="size-5" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="max-w-full truncate text-sm font-medium" title={item.file.name}>
            {item.file.name}
          </span>
          <StatusChip item={item} />
        </div>
        <p className="text-muted-foreground mt-0.5 text-xs">{formatBytes(item.file.size)}</p>

        {item.status === 'running' && <Progress value={item.progress} className="mt-2" />}
        {item.status === 'error' && item.error && (
          <p className="text-destructive mt-1 text-xs leading-relaxed">{item.error}</p>
        )}

        {item.results.map((r, idx) => (
          <div key={idx} className="mt-2 flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => downloadBlob(r.blob, r.name)}
              className="max-w-xs"
            >
              <Download />
              <span className="truncate">{r.name}</span>
              <span className="text-muted-foreground shrink-0 text-xs">{formatBytes(r.blob.size)}</span>
            </Button>
          </div>
        ))}
        {item.results.some((r) => r.preview) && (
          <TextPreview text={item.results.find((r) => r.preview)!.preview!} />
        )}
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="移除"
        disabled={item.status === 'running'}
        onClick={() => onRemove(item.id)}
      >
        <X />
      </Button>
    </div>
  )
}

export function FileList({ items, onRemove }: { items: QueueItem[]; onRemove: (id: string) => void }) {
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <FileRow key={item.id} item={item} onRemove={onRemove} />
      ))}
    </div>
  )
}
