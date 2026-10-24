import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { CopyButton, ErrorText, TextArea, ToolShell } from '@/components/tool-shell'

/** 单趟编码：命名实体优先（& < > " ' 空格），其余非 ASCII 用数字实体 */
const NAMED: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '\u00A0': '&nbsp;',
}

function encodeEntities(text: string): string {
  return text.replace(/[&<>"'\u00A0-\u9999]/g, (ch) => NAMED[ch] ?? `&#${ch.codePointAt(0)};`)
}

function decodeEntities(text: string): string {
  const ta = document.createElement('textarea')
  ta.innerHTML = text
  return ta.value
}

export default function HtmlEntityPage() {
  const [raw, setRaw] = useState('<div class="a">中文 & 引号 "测试"</div>')
  const [out, setOut] = useState('')
  const [err, setErr] = useState('')

  return (
    <ToolShell title="HTML 实体编解码" desc="文本转 HTML 实体（&amp;amp; 等），或把实体还原为字符，覆盖命名与数字实体">
      <div className="rounded-xl border p-4">
        <div className="mb-3 flex gap-2">
          <Button size="sm" onClick={() => { setErr(''); setOut(encodeEntities(raw)) }}>
            编码 → 实体
          </Button>
          <Button size="sm" variant="outline" onClick={() => { setErr(''); setOut(decodeEntities(raw)) }}>
            解码 → 字符
          </Button>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs font-medium">输入</span>
              <CopyButton text={raw} />
            </div>
            <TextArea value={raw} onChange={setRaw} rows={8} placeholder="输入文本或 HTML 实体…" />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs font-medium">输出</span>
              <CopyButton text={out} />
            </div>
            <TextArea value={out} readOnly rows={8} />
          </div>
        </div>
        <ErrorText>{err}</ErrorText>
      </div>
    </ToolShell>
  )
}
