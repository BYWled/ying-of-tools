import { useState } from 'react'
import { ArrowDownUp, Copy, Download, FileInput } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { DropZone } from '@/components/converter/drop-zone'
import { copyText, downloadBlob } from '@/lib/utils'

function toBase64(bytes: Uint8Array): string {
  let bin = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(bin)
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={async () => {
        if (await copyText(text)) {
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        }
      }}
    >
      {copied ? '已复制' : (
        <>
          <Copy />
          复制
        </>
      )}
    </Button>
  )
}

export default function Base64Page() {
  const [mode, setMode] = useState<'file' | 'text'>('file')

  // 文件模式
  const [dataUrl, setDataUrl] = useState('')
  const [fileName, setFileName] = useState('')
  const [b64Only, setB64Only] = useState(false)

  // 文本模式
  const [plain, setPlain] = useState('')
  const [encoded, setEncoded] = useState('')
  const [err, setErr] = useState('')

  const onFile = async (files: File[]) => {
    const f = files[0]
    if (!f) return
    const bytes = new Uint8Array(await f.arrayBuffer())
    const b64 = toBase64(bytes)
    setDataUrl(`data:${f.type || 'application/octet-stream'};base64,${b64}`)
    setFileName(f.name)
  }

  const output = b64Only ? dataUrl.split(',')[1] ?? '' : dataUrl

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-heading text-2xl font-semibold md:text-3xl">Base64 编解码</h1>
        <p className="text-muted-foreground mt-1">任意文件转 Data URL（可内嵌网页），或文本与 Base64 双向转换</p>
      </header>

      <div className="flex gap-2">
        <Button variant={mode === 'file' ? 'default' : 'outline'} className="rounded-full" onClick={() => setMode('file')}>
          <FileInput />
          文件 → Base64
        </Button>
        <Button variant={mode === 'text' ? 'default' : 'outline'} className="rounded-full" onClick={() => setMode('text')}>
          <ArrowDownUp />
          文本编解码
        </Button>
      </div>

      {mode === 'file' ? (
        <div className="space-y-4">
          <DropZone accept="*" multiple={false} onFiles={onFile} hint="任意文件均可（图片 / 字体 / 文档…）" />
          {dataUrl && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>输出（{fileName}）</Label>
                <div className="flex items-center gap-3">
                  <label className="text-muted-foreground flex items-center gap-2 text-xs">
                    仅 Base64 部分
                    <Switch checked={b64Only} onCheckedChange={setB64Only} />
                  </label>
                  <CopyButton text={output} />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => downloadBlob(new Blob([output], { type: 'text/plain;charset=utf-8' }), `${fileName}.base64.txt`)}
                  >
                    <Download />
                    下载
                  </Button>
                </div>
              </div>
              <textarea
                readOnly
                value={output}
                rows={8}
                className="bg-muted/40 w-full rounded-lg border p-3 font-mono text-xs break-all"
              />
              {fileName.match(/\.(png|jpe?g|gif|webp|svg)$/i) && !b64Only && (
                <img src={dataUrl} alt="预览" className="max-h-48 rounded-lg border" />
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>明文</Label>
            <textarea
              value={plain}
              onChange={(e) => setPlain(e.target.value)}
              rows={8}
              className="border-input w-full rounded-md border bg-transparent p-3 font-mono text-sm outline-none"
              placeholder="输入要编码的文本…"
            />
            <Button
              className="w-full"
              onClick={() => {
                setErr('')
                try {
                  setEncoded(toBase64(new TextEncoder().encode(plain)))
                } catch (e) {
                  setErr(e instanceof Error ? e.message : String(e))
                }
              }}
            >
              编码 → Base64
            </Button>
          </div>
          <div className="space-y-2">
            <Label>Base64</Label>
            <textarea
              value={encoded}
              onChange={(e) => setEncoded(e.target.value)}
              rows={8}
              className="border-input w-full rounded-md border bg-transparent p-3 font-mono text-sm break-all outline-none"
              placeholder="粘贴 Base64 后点击解码…"
            />
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => {
                setErr('')
                try {
                  const bin = atob(encoded.trim())
                  const bytes = new Uint8Array(bin.length)
                  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
                  setPlain(new TextDecoder().decode(bytes))
                } catch {
                  setErr('解码失败：不是有效的 Base64 字符串')
                }
              }}
            >
              解码 → 明文
            </Button>
          </div>
          {err && <p className="text-destructive md:col-span-2 text-sm">{err}</p>}
        </div>
      )}
    </div>
  )
}
