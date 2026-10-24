import { useEffect, useMemo, useRef, useState } from 'react'
import { Pause, Play, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SimpleSelect } from '@/components/ui/select'
import { ToolShell } from '@/components/tool-shell'

export default function TtsPage() {
  const [text, setText] = useState('你好，这里是伴莺的工具箱。文字转语音功能完全在浏览器本地运行。')
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [voiceURI, setVoiceURI] = useState('')
  const [rate, setRate] = useState(1)
  const [pitch, setPitch] = useState(1)
  const [speaking, setSpeaking] = useState(false)
  const [paused, setPaused] = useState(false)
  const [error, setError] = useState('')
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window
  const rateTimer = useRef<number | null>(null)

  useEffect(() => {
    if (!supported) return
    const load = () => {
      const list = window.speechSynthesis.getVoices()
      if (list.length) {
        setVoices(list)
        setVoiceURI((prev) => prev || list.find((v) => v.lang.startsWith('zh'))?.voiceURI || list[0].voiceURI)
      }
    }
    load()
    window.speechSynthesis.addEventListener('voiceschanged', load)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load)
  }, [supported])

  useEffect(() => () => window.speechSynthesis.cancel(), [])

  const zhVoices = useMemo(() => voices.filter((v) => v.lang.toLowerCase().startsWith('zh')), [voices])
  const otherVoices = useMemo(() => voices.filter((v) => !v.lang.toLowerCase().startsWith('zh')), [voices])
  const voiceOptions = [
    ...zhVoices.map((v) => ({ value: v.voiceURI, label: `【中文】${v.name} (${v.lang})` })),
    ...otherVoices.map((v) => ({ value: v.voiceURI, label: `${v.name} (${v.lang})` })),
  ]

  // 语音结束后修正按钮状态（onend 在部分浏览器不可靠，兜底轮询）
  useEffect(() => {
    if (!speaking) return
    rateTimer.current = window.setInterval(() => {
      if (!window.speechSynthesis.speaking) {
        setSpeaking(false)
        setPaused(false)
      }
    }, 500)
    return () => {
      if (rateTimer.current) window.clearInterval(rateTimer.current)
    }
  }, [speaking])

  const speak = () => {
    if (!text.trim()) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    const v = voices.find((x) => x.voiceURI === voiceURI)
    if (v) u.voice = v
    u.rate = rate
    u.pitch = pitch
    u.onend = () => {
      setSpeaking(false)
      setPaused(false)
    }
    u.onerror = (e) => {
      setError(`朗读失败：${e.error}`)
      setSpeaking(false)
    }
    setError('')
    setSpeaking(true)
    setPaused(false)
    window.speechSynthesis.speak(u)
  }

  if (!supported) {
    return (
      <ToolShell title="文字转语音" desc="使用浏览器内置语音合成引擎朗读文本">
        <p className="text-destructive rounded-xl border p-6 text-center text-sm">
          当前浏览器不支持 Web Speech API，请使用 Chrome / Edge 等现代浏览器。
        </p>
      </ToolShell>
    )
  }

  return (
    <ToolShell title="文字转语音" desc="调用系统语音引擎本地朗读，可选音色、语速与音调，无需联网上传文本">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        maxLength={5000}
        placeholder="输入要朗读的文本…"
        className="border-input bg-muted/30 w-full rounded-lg border p-3 text-sm outline-none focus:border-primary/50"
      />
      <p className="text-muted-foreground -mt-2 text-right text-xs">{text.length} / 5000</p>

      <div className="grid gap-4 rounded-xl border p-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <span className="text-muted-foreground text-xs font-medium">音色</span>
          <SimpleSelect value={voiceURI} onChange={setVoiceURI} options={voiceOptions.length ? voiceOptions : [{ value: '', label: '加载中…' }]} />
        </div>
        <div className="space-y-1.5">
          <span className="text-muted-foreground text-xs font-medium">语速 {rate.toFixed(1)}x</span>
          <input type="range" min={0.5} max={2} step={0.1} value={rate} onChange={(e) => setRate(Number(e.target.value))} className="accent-primary w-full" />
        </div>
        <div className="space-y-1.5">
          <span className="text-muted-foreground text-xs font-medium">音调 {pitch.toFixed(1)}</span>
          <input type="range" min={0.5} max={2} step={0.1} value={pitch} onChange={(e) => setPitch(Number(e.target.value))} className="accent-primary w-full" />
        </div>
      </div>

      <div className="flex gap-2">
        {!speaking && (
          <Button onClick={speak} disabled={!text.trim()}>
            <Play />
            开始朗读
          </Button>
        )}
        {speaking && !paused && (
          <Button variant="outline" onClick={() => { window.speechSynthesis.pause(); setPaused(true) }}>
            <Pause />
            暂停
          </Button>
        )}
        {speaking && paused && (
          <Button onClick={() => { window.speechSynthesis.resume(); setPaused(false) }}>
            <Play />
            继续
          </Button>
        )}
        {speaking && (
          <Button variant="destructive" onClick={() => { window.speechSynthesis.cancel(); setSpeaking(false); setPaused(false) }}>
            <Square />
            停止
          </Button>
        )}
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
      <p className="text-muted-foreground text-xs">
        音色列表来自操作系统与浏览器（Windows / macOS / 移动端各不相同），中文音色可能需要安装语言包。语音由系统引擎即时合成，本站不发送任何文本到服务器。
      </p>
    </ToolShell>
  )
}
