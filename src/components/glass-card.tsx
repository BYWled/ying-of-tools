import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * 玻璃卡片（光谱前台风格）：半透明 + backdrop-blur + 可选发光。
 * 需放在有彩色背景的容器内才能体现毛玻璃效果。
 */
function GlassCard({
  className,
  glow = false,
  ...props
}: React.ComponentProps<'div'> & { glow?: boolean }) {
  return (
    <div className={cn('glass rounded-2xl', glow && 'glow-primary', className)} {...props} />
  )
}

export { GlassCard }
