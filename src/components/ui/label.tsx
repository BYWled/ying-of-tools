import * as React from 'react'
import * as LabelPrimitive from 'radix-ui'
import { cn } from '@/lib/utils'

function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Label.Root>) {
  return (
    <LabelPrimitive.Label.Root
      className={cn(
        'flex items-center gap-2 text-sm leading-none font-medium select-none',
        className,
      )}
      {...props}
    />
  )
}

export { Label }
