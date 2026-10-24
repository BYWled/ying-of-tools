import type { ReactNode } from 'react'
import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { copyText } from '@/lib/utils'

/** 交互式工具页统一骨架：标题 + 说明 + 内容区 */
export function ToolShell({
  title,
  desc,
  children,
  wide = false,
}: {
  title: string
  desc: string
  children: ReactNode
  wide?: boolean
}) {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-heading text-2xl font-semibold md:text-3xl">{title}</h1>
        <p className="text-muted-foreground mt-1 text-sm md:text-base">{desc}</p>
      </header>
      <div className={wide ? 'space-y-4' : 'mx-auto max-w-4xl space-y-4'}>{children}</div>
    </div>
  )
}

export function CopyButton({ text, label = '复制', size = 'sm' }: { text: string; label?: string; size?: 'sm' | 'default' }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      variant="secondary"
      size={size}
      disabled={!text}
      onClick={async () => {
        if (await copyText(text)) {
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        }
      }}
    >
      {copied ? <Check /> : <Copy />}
      {copied ? '已复制' : label}
    </Button>
  )
}

export function TextArea({
  value,
  onChange,
  placeholder,
  rows = 8,
  readOnly,
  className,
  mono = true,
}: {
  value: string
  onChange?: (v: string) => void
  placeholder?: string
  rows?: number
  readOnly?: boolean
  className?: string
  mono?: boolean
}) {
  return (
    <textarea
      value={value}
      readOnly={readOnly}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      spellCheck={false}
      className={cn(
        'border-input bg-muted/30 w-full rounded-lg border p-3 text-sm outline-none transition-colors focus:border-primary/50',
        mono && 'font-mono text-xs leading-relaxed',
        readOnly && 'break-all',
        className,
      )}
    />
  )
}

export function FieldRow({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
      </div>
      {children}
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  )
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null
  return <p className="text-destructive text-sm">{children}</p>
}

export function ResultCard({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="bg-muted/40 space-y-1.5 rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-xs font-medium">{label}</span>
        <CopyButton text={value} />
      </div>
      <p className={cn('text-sm break-all', mono && 'font-mono')}>{value || '—'}</p>
    </div>
  )
}
