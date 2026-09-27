import { useCallback, useEffect, useRef, useState } from 'react'
import { FilePlus2, UploadCloud } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DropZoneProps {
  accept?: string
  multiple?: boolean
  disabled?: boolean
  onFiles: (files: File[]) => void
  hint?: string
  compact?: boolean
}

/** 拖放 / 点选 / 粘贴 三合一文件入口（玻璃拟态） */
export function DropZone({ accept, multiple = false, disabled, onFiles, hint, compact }: DropZoneProps) {
  const [drag, setDrag] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const depth = useRef(0)

  const handleFiles = useCallback(
    (list: FileList | null) => {
      if (!list || disabled) return
      onFiles(Array.from(list))
    },
    [disabled, onFiles],
  )

  // 支持粘贴图片（仅有精确指针/带键盘的设备才有意义）
  const acceptsImage = accept?.includes('image')
  const [canPaste, setCanPaste] = useState(false)
  useEffect(() => {
    setCanPaste(Boolean(acceptsImage) && window.matchMedia('(pointer: fine)').matches)
  }, [acceptsImage])
  useEffect(() => {
    if (!canPaste) return
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? [])
      if (files.length) onFiles(files)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [canPaste, onFiles])

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="添加文件"
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
      onDragEnter={(e) => {
        e.preventDefault()
        depth.current++
        setDrag(true)
      }}
      onDragLeave={(e) => {
        e.preventDefault()
        if (--depth.current <= 0) {
          depth.current = 0
          setDrag(false)
        }
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        depth.current = 0
        setDrag(false)
        handleFiles(e.dataTransfer.files)
      }}
      className={cn(
        'glass group relative w-full cursor-pointer overflow-hidden rounded-2xl outline-none transition-all',
        'border-dashed border-2 border-border/80 hover:border-primary/50 focus-visible:border-primary',
        compact ? 'px-4 py-6' : 'px-6 py-12',
        drag && 'border-primary bg-primary/5 border-solid scale-[1.01]',
        disabled && 'pointer-events-none opacity-50',
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files)
          e.target.value = ''
        }}
      />
      <div className="flex flex-col items-center gap-3 text-center select-none">
        <div
          className={cn(
            'bg-primary/10 text-primary flex items-center justify-center rounded-2xl transition-transform group-hover:scale-105',
            compact ? 'size-10' : 'size-14',
          )}
        >
          {drag ? <FilePlus2 className={compact ? 'size-5' : 'size-7'} /> : <UploadCloud className={compact ? 'size-5' : 'size-7'} />}
        </div>
        <div>
          <p className="text-sm font-medium md:text-base">
            {drag ? '松开即可添加' : '拖放文件到此处，或点击选择'}
          </p>
          <p className="text-muted-foreground mt-1 text-xs md:text-sm">
            {hint ?? (multiple ? '可添加多个文件，支持 Ctrl 多选' : '单文件')}
            {canPaste ? '，也可直接 Ctrl+V 粘贴图片' : ''}
          </p>
        </div>
      </div>
    </div>
  )
}
