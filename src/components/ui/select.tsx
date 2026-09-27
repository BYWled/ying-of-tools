import { useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import * as SelectPrimitive from 'radix-ui'
import { cn } from '@/lib/utils'

const Select = SelectPrimitive.Select
const SelectGroup = SelectPrimitive.Select.Group
const SelectValue = SelectPrimitive.Select.Value

function SelectTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Select.Trigger>) {
  return (
    <SelectPrimitive.Select.Trigger
      className={cn(
        'border-input bg-transparent flex h-9 w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none',
        'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        'disabled:cursor-not-allowed disabled:opacity-50 data-[placeholder]:text-muted-foreground',
        '[&_svg]:pointer-events-none [&_svg]:shrink-0',
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Select.Icon asChild>
        <ChevronDown className="size-4 opacity-50" />
      </SelectPrimitive.Select.Icon>
    </SelectPrimitive.Select.Trigger>
  )
}

function SelectContent({
  className,
  children,
  position = 'popper',
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Select.Content>) {
  return (
    <SelectPrimitive.Select.Portal>
      <SelectPrimitive.Select.Content
        position={position}
        className={cn(
          // 不使用退场动画：部分环境下 animationend 不触发会导致 Radix 等待卸载、锁住指针
          'bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=open]:fade-in-0 z-50 max-h-72 min-w-32 overflow-y-auto rounded-lg border shadow-md',
          className,
        )}
        {...props}
      >
        <SelectPrimitive.Select.Viewport className="p-1">{children}</SelectPrimitive.Select.Viewport>
      </SelectPrimitive.Select.Content>
    </SelectPrimitive.Select.Portal>
  )
}

function SelectItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Select.Item>) {
  return (
    <SelectPrimitive.Select.Item
      className={cn(
        'focus:bg-accent focus:text-accent-foreground relative flex w-full cursor-pointer items-center gap-2 rounded-md py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className,
      )}
      {...props}
    >
      <span className="absolute right-2 flex size-3.5 items-center justify-center">
        <SelectPrimitive.Select.ItemIndicator>
          <Check className="size-4" />
        </SelectPrimitive.Select.ItemIndicator>
      </span>
      <SelectPrimitive.Select.ItemText>{children}</SelectPrimitive.Select.ItemText>
    </SelectPrimitive.Select.Item>
  )
}

// 轻量 select：用于简单下拉场景（避免 Native select 与主题不一致）
function SimpleSelect({
  value,
  onChange,
  options,
  className,
  disabled,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  className?: string
  disabled?: boolean
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <Select.Root open={open} onOpenChange={setOpen} value={value} onValueChange={onChange}>
      <SelectTrigger className={className} disabled={disabled}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select.Root>
  )
}

export { Select, SelectGroup, SelectValue, SelectTrigger, SelectContent, SelectItem, SimpleSelect }
