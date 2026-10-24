import { useMemo, useState } from 'react'
import { TextArea, ToolShell } from '@/components/tool-shell'

function b64UrlDecode(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

function prettyJson(s: string): string {
  try {
    return JSON.stringify(JSON.parse(s), null, 2)
  } catch {
    return s
  }
}

function fmtTs(v: unknown): string | null {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null
  const ms = v > 1e12 ? v : v * 1000
  if (ms < 1e12 || ms > 4e12) return null
  return new Date(ms).toLocaleString('zh-CN')
}

export default function JwtPage() {
  const [token, setToken] = useState(
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IuS4reWbgyIsImlhdCI6MTc2MTEzOTIwMCwiZXhwIjoxNzkzMjczNjAwfQ.2fH3QF1tN0ZR8MjV9rJq-KvG5uXs7bS5dW8Yg3R6l0M',
  )

  const parsed = useMemo(() => {
    const t = token.trim()
    if (!t) return { ok: false, msg: '' }
    const parts = t.split('.')
    if (parts.length < 2 || parts.length > 3) return { ok: false, msg: 'JWT 应为 header.payload.signature 三段式（至少两段）' }
    try {
      const header = prettyJson(b64UrlDecode(parts[0]))
      const payloadRaw = b64UrlDecode(parts[1])
      const payload = prettyJson(payloadRaw)
      let claims: Record<string, unknown> = {}
      try {
        claims = JSON.parse(payloadRaw)
      } catch {
        /* payload 不是 JSON */
      }
      const iat = fmtTs(claims.iat)
      const exp = fmtTs(claims.exp)
      const nbf = fmtTs(claims.nbf)
      const expired = exp ? new Date(exp.replace(/[^0-9]/g, '/')).getTime() : null
      void expired
      return {
        ok: true,
        msg: '',
        header,
        payload,
        signature: parts[2] ?? '（无签名段）',
        exp,
        iat,
        nbf,
        expState: claims.exp ? (Number(claims.exp) * 1000 < Date.now() ? 'expired' : 'valid') : null,
      }
    } catch {
      return { ok: false, msg: '解析失败：段内容不是有效的 Base64URL 编码' }
    }
  }, [token])

  return (
    <ToolShell title="JWT 解码" desc="解码 Header / Payload，展示签发与过期时间。仅本地解码，不验证签名">
      <div className="rounded-xl border p-4">
        <span className="text-muted-foreground text-xs font-medium">粘贴 JWT（eyJ… 格式）</span>
        <TextArea value={token} onChange={setToken} rows={4} placeholder="eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.xxxxx" />
        {parsed.ok ? (
          <>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {parsed.iat && <div className="bg-muted/40 rounded-lg border p-3 text-xs"><span className="text-muted-foreground">iat 签发于</span><p className="mt-1 font-mono">{parsed.iat}</p></div>}
              {parsed.exp && (
                <div className={`rounded-lg border p-3 text-xs ${parsed.expState === 'expired' ? 'bg-red-500/10' : 'bg-emerald-500/10'}`}>
                  <span className="text-muted-foreground">exp 过期于</span>
                  <p className="mt-1 font-mono">{parsed.exp}</p>
                  {parsed.expState === 'expired' && <p className="text-destructive mt-1 font-medium">已过期</p>}
                </div>
              )}
              {parsed.nbf && <div className="bg-muted/40 rounded-lg border p-3 text-xs"><span className="text-muted-foreground">nbf 生效于</span><p className="mt-1 font-mono">{parsed.nbf}</p></div>}
            </div>
            <div className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <span className="text-muted-foreground text-xs font-medium">Header（红色段）</span>
                <pre className="bg-muted/30 overflow-auto rounded-lg border p-3 font-mono text-xs leading-relaxed">{parsed.header}</pre>
              </div>
              <div className="space-y-1.5">
                <span className="text-muted-foreground text-xs font-medium">Payload（紫色段）</span>
                <pre className="bg-muted/30 overflow-auto rounded-lg border p-3 font-mono text-xs leading-relaxed">{parsed.payload}</pre>
              </div>
              <div className="space-y-1.5">
                <span className="text-muted-foreground text-xs font-medium">Signature（青色段）</span>
                <p className="bg-muted/30 rounded-lg border p-3 font-mono text-xs break-all">{parsed.signature}</p>
              </div>
            </div>
          </>
        ) : (
          parsed.msg && <p className="text-destructive mt-2 text-sm">{parsed.msg}</p>
        )}
      </div>
      <p className="text-muted-foreground text-xs">提示：解码过程完全在浏览器本地完成，内容不会上传。JWT 默认不加密，请勿粘贴含敏感信息的令牌到不受信任的网站。</p>
    </ToolShell>
  )
}
