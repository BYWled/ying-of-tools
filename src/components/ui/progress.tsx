import * as React from 'react'
import { cn } from '@/lib/utils'

function Progress({
  value = 0,
  indeterminate = false,
  className,
  ...props
}: React.ComponentProps<'div'> & { value?: number; indeterminate?: boolean }) {
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={indeterminate ? undefined : Math.round(value * 100)}
      className={cn('bg-primary/15 relative h-2 w-full overflow-hidden rounded-full', className)}
      {...props}
    >
      <div
        className={cn(
          'bg-primary h-full rounded-full transition-[width] duration-300',
          indeterminate && 'animate-pulse w-1/3',
        )}
        style={indeterminate ? undefined : { width: `${Math.min(100, Math.max(0, value * 100))}%` }}
      />
    </div>
  )
}

export { Progress }
