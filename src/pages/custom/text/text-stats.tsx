import { useMemo, useState } from 'react'
import { TextArea, ToolShell } from '@/components/tool-shell'

export default function TextStatsPage() {
  const [text, setText] = useState('在这里粘贴或输入文本，实时统计字数与词频。\nHello world, 你好世界。')

  const s = useMemo(() => {
    const chars = text.length
    const noSpace = text.replace(/\s/g, '').length
    const lines = text === '' ? 0 : text.split('\n').length
    const paras = text.split(/\n\s*\n/).filter((p) => p.trim()).length
    const sentences = (text.match(/[。！？!?…]+|[.](?=\s|$)/g) ?? []).length
    // 中文按字计数，英文按词计数（uutool/Word 通行口径）
    const cjk = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) ?? []).length
    const latinWords = (text.replace(/[\u4e00-\u9fff\u3400-\u4dbf]/g, ' ').match(/[A-Za-z0-9'’-]+/g) ?? []).length
    const words = cjk + latinWords

    // 词频（中文按字粒度太碎，统计英文单词 + 中文双字词简化：这里统计英文词与中文字符 Top）
    const freq = new Map<string, number>()
    for (const w of text.toLowerCase().match(/[A-Za-z][A-Za-z0-9'-]{1,}/g) ?? []) {
      freq.set(w, (freq.get(w) ?? 0) + 1)
    }
    const top = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)

    // 阅读时间：中文 300 字/分钟，英文 200 词/分钟
    const minutes = cjk / 300 + latinWords / 200

    return { chars, noSpace, lines, paras, sentences, cjk, latinWords, words, top, minutes }
  }, [text])

  const items = [
    { label: '总字数（含空白）', value: s.chars },
    { label: '字数（不含空白）', value: s.noSpace },
    { label: '字数（中文+英文词）', value: s.words },
    { label: '中文字符', value: s.cjk },
    { label: '英文单词', value: s.latinWords },
    { label: '行数', value: s.lines },
    { label: '段落数', value: s.paras },
    { label: '句子数', value: s.sentences },
  ]

  return (
    <ToolShell title="文本统计" desc="实时统计字符、中文、英文词、行数、句数与高频词，附阅读时长估算">
      <TextArea value={text} onChange={setText} rows={10} mono={false} placeholder="粘贴文本…" />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {items.map((i) => (
          <div key={i.label} className="rounded-lg border p-3 text-center">
            <p className="font-mono text-xl font-semibold">{i.value.toLocaleString()}</p>
            <p className="text-muted-foreground mt-1 text-xs">{i.label}</p>
          </div>
        ))}
      </div>
      <div className="rounded-lg border p-4">
        <p className="mb-2 text-sm font-medium">
          预计阅读时长：约 {s.minutes < 1 ? '<1' : Math.round(s.minutes)} 分钟
        </p>
        {s.top.length > 0 ? (
          <>
            <p className="text-muted-foreground mb-2 text-xs">高频英文词 Top 15</p>
            <div className="flex flex-wrap gap-1.5">
              {s.top.map(([w, n]) => (
                <span key={w} className="bg-muted rounded-full px-2.5 py-1 font-mono text-xs">
                  {w} <span className="text-primary font-semibold">{n}</span>
                </span>
              ))}
            </div>
          </>
        ) : (
          <p className="text-muted-foreground text-xs">暂无英文词频数据</p>
        )}
      </div>
    </ToolShell>
  )
}
