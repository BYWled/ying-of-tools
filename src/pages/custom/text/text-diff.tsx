import { useMemo, useState } from 'react'
import { CopyButton, TextArea, ToolShell } from '@/components/tool-shell'

type Op = 0 | -1 | 1 // 0=相同 -1=左删 1=右增

/** 经典 LCS 行级 diff（输入行数 ≤4000 时秒级完成） */
function diffLines(a: string[], b: string[]): { op: Op; line: string }[] {
  const n = a.length
  const m = b.length
  // LCS 长度表（Int32Array 压内存）
  const dp = new Int32Array((n + 1) * (m + 1))
  const W = m + 1
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i * W + j] = a[i] === b[j] ? dp[(i + 1) * W + j + 1] + 1 : Math.max(dp[(i + 1) * W + j], dp[i * W + j + 1])
    }
  }
  const out: { op: Op; line: string }[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ op: 0, line: a[i] })
      i++
      j++
    } else if (dp[(i + 1) * W + j] >= dp[i * W + j + 1]) {
      out.push({ op: -1, line: a[i] })
      i++
    } else {
      out.push({ op: 1, line: b[j] })
      j++
    }
  }
  while (i < n) out.push({ op: -1, line: a[i++] })
  while (j < m) out.push({ op: 1, line: b[j++] })
  return out
}

export default function TextDiffPage() {
  const [left, setLeft] = useState('原来的第一行\n共同的第二行\n原来的第三行\n只存在于左边')
  const [right, setRight] = useState('修改后的第一行\n共同的第二行\n原来的第三行\n只存在于右边的新行')

  const { rows, adds, dels, same } = useMemo(() => {
    const a = left.split('\n')
    const b = right.split('\n')
    if (a.length * b.length > 16_000_000) return { rows: [], adds: 0, dels: 0, same: 0, tooBig: true } as never
    const rows = diffLines(a, b)
    let adds = 0
    let dels = 0
    let same = 0
    for (const r of rows) {
      if (r.op === 1) adds++
      else if (r.op === -1) dels++
      else same++
    }
    return { rows, adds, dels, same }
  }, [left, right])

  const patch = useMemo(
    () => rows.map((r) => (r.op === 1 ? `+ ${r.line}` : r.op === -1 ? `- ${r.line}` : `  ${r.line}`)).join('\n'),
    [rows],
  )

  return (
    <ToolShell
      title="文本差异对比"
      desc="逐行比较两段文本，新增绿色、删除红色，统计差异行数，可导出 patch 风格结果"
      wide
    >
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <span className="text-muted-foreground text-xs font-medium">原文本</span>
          <TextArea value={left} onChange={setLeft} rows={10} mono={false} />
        </div>
        <div className="space-y-1.5">
          <span className="text-muted-foreground text-xs font-medium">新文本</span>
          <TextArea value={right} onChange={setRight} rows={10} mono={false} />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2 text-xs">
          <span className="rounded-full border px-2.5 py-1">相同 {same} 行</span>
          <span className="rounded-full border bg-red-500/10 px-2.5 py-1 text-red-600">删除 {dels} 行</span>
          <span className="rounded-full border bg-emerald-500/10 px-2.5 py-1 text-emerald-600">新增 {adds} 行</span>
        </div>
        <CopyButton text={patch} label="复制对比结果" />
      </div>

      <div className="overflow-hidden rounded-xl border font-mono text-xs">
        {rows.map((r, i) => (
          <div
            key={i}
            className={
              r.op === -1
                ? 'flex gap-2 border-red-500/20 bg-red-500/10 px-3 py-1'
                : r.op === 1
                  ? 'flex gap-2 border-emerald-500/20 bg-emerald-500/10 px-3 py-1'
                  : 'flex gap-2 px-3 py-1'
            }
          >
            <span className="text-muted-foreground w-4 shrink-0 select-none">{r.op === 1 ? '+' : r.op === -1 ? '-' : ' '}</span>
            <span className="whitespace-pre-wrap break-all">{r.line || ' '}</span>
          </div>
        ))}
      </div>
    </ToolShell>
  )
}
