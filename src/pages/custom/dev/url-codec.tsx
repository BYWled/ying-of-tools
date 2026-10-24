import { useMemo, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CopyButton, ErrorText, TextArea, ToolShell } from '@/components/tool-shell'

export default function UrlCodecPage() {
  const [plain, setPlain] = useState('https://tools.wled.top/tool/base64?关键词=伴莺 工具箱&x=1')
  const [encoded, setEncoded] = useState('')
  const [err, setErr] = useState('')
  const [urlForParse, setUrlForParse] = useState('https://example.com/search?q=在线工具&lang=zh&page=2')

  const decodedTable = useMemo(() => {
    try {
      const u = new URL(urlForParse)
      const rows: [string, string][] = []
      u.searchParams.forEach((v, k) => rows.push([k, v]))
      return { ok: true as const, href: u.href, protocol: u.protocol.replace(':', ''), host: u.host, path: u.pathname, rows }
    } catch {
      return { ok: false as const }
    }
  }, [urlForParse])

  return (
    <ToolShell
      title="URL 编解码"
      desc="encodeURIComponent / encodeURI 双向转换，附带 URL 参数解析表格"
    >
      <div className="rounded-xl border p-4">
        <div className="mb-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => {
              setErr('')
              try {
                setEncoded(encodeURIComponent(plain))
              } catch (e) {
                setErr(String(e))
              }
            }}
          >
            编码（组件级）
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setErr('')
              try {
                setEncoded(encodeURI(plain))
              } catch (e) {
                setErr(String(e))
              }
            }}
          >
            编码（整条 URL）
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setErr('')
              try {
                setPlain(decodeURIComponent(encoded))
              } catch {
                setErr('解码失败：包含非法的百分号转义序列')
              }
            }}
          >
            <ArrowRight className="rotate-180" />
            解码 → 明文
          </Button>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs font-medium">明文</span>
              <CopyButton text={plain} />
            </div>
            <TextArea value={plain} onChange={setPlain} rows={7} placeholder="输入要编码的文本 / URL" />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs font-medium">编码结果</span>
              <CopyButton text={encoded} />
            </div>
            <TextArea value={encoded} onChange={setEncoded} rows={7} placeholder="粘贴编码串后点「解码」" />
          </div>
        </div>
        <ErrorText>{err}</ErrorText>
      </div>

      <div className="rounded-xl border p-4">
        <p className="mb-3 text-sm font-medium">URL 参数解析</p>
        <Input value={urlForParse} onChange={(e) => setUrlForParse(e.target.value)} placeholder="粘贴完整 URL" className="font-mono text-xs" />
        {decodedTable.ok ? (
          <div className="mt-3 space-y-3">
            <div className="text-muted-foreground grid gap-1 text-xs sm:grid-cols-3">
              <span>协议：{decodedTable.protocol}</span>
              <span>主机：{decodedTable.host}</span>
              <span>路径：{decodedTable.path}</span>
            </div>
            {decodedTable.rows.length > 0 ? (
              <div className="overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">参数名</th>
                      <th className="px-3 py-2 text-left font-medium">解码后的值</th>
                    </tr>
                  </thead>
                  <tbody>
                    {decodedTable.rows.map(([k, v], i) => (
                      <tr key={i} className="border-t">
                        <td className="px-3 py-2 font-mono text-xs break-all">{k}</td>
                        <td className="px-3 py-2 font-mono text-xs break-all">{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">该 URL 没有查询参数</p>
            )}
          </div>
        ) : (
          <p className="text-destructive mt-2 text-sm">不是有效的 URL（需要以 http:// 或 https:// 开头）</p>
        )}
      </div>
    </ToolShell>
  )
}
