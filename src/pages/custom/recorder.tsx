import { useEffect, useRef, useState } from 'react'
import { Mic, Pause, Play, Save, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SimpleSelect } from '@/components/ui/select'
import { ToolShell } from '@/components/tool-shell'
import { downloadBlob } from '@/lib/utils'

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function RecorderPage() {
  const [state, setState] = useState<'idle' | 'recording' | 'paused' | 'done'>('idle')
  const [seconds, setSeconds] = useState(0)
  const [audioUrl, setAudioUrl] = useState('')
  const [mimeType, setMimeType] = useState('')
  const [error, setError] = useState('')
  const [deviceLabel, setDeviceLabel] = useState('默认麦克风')
  const [devices, setDevices] = useState<{ deviceId: string; label: string }[]>([])

  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<number | null>(null)
  const blobRef = useRef<Blob | null>(null)
  const [deviceId, setDeviceId] = useState('')

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  const listDevices = async () => {
    try {
      const all = await navigator.mediaDevices.enumerateDevices()
      setDevices(
        all
          .filter((d) => d.kind === 'audioinput')
          .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `麦克风 ${i + 1}` })),
      )
    } catch {
      /* 忽略 */
    }
  }

  const start = async () => {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: deviceId ? { deviceId: { exact: deviceId } } : true,
      })
      streamRef.current = stream
      const track = stream.getAudioTracks()[0]
      setDeviceLabel(track?.label || '默认麦克风')
      void listDevices()

      const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
      const mt = candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? ''
      const rec = new MediaRecorder(stream, mt ? { mimeType: mt } : undefined)
      recorderRef.current = rec
      chunksRef.current = []
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' })
        blobRef.current = blob
        setMimeType(rec.mimeType || 'audio/webm')
        setAudioUrl(URL.createObjectURL(blob))
        setState('done')
        stream.getTracks().forEach((t) => t.stop())
      }
      rec.start(500)
      setState('recording')
      setSeconds(0)
      const t0 = Date.now()
      timerRef.current = window.setInterval(() => setSeconds((Date.now() - t0) / 1000), 200)
    } catch (e) {
      setError(
        e instanceof Error && e.name === 'NotAllowedError'
          ? '麦克风权限被拒绝，请在浏览器地址栏允许麦克风访问'
          : `无法启动录音：${e instanceof Error ? e.message : String(e)}`,
      )
    }
  }

  const pause = () => {
    recorderRef.current?.pause()
    setState('paused')
    if (timerRef.current) window.clearInterval(timerRef.current)
  }

  const resume = () => {
    recorderRef.current?.resume()
    setState('recording')
    const t0 = Date.now() - seconds * 1000
    timerRef.current = window.setInterval(() => setSeconds((Date.now() - t0) / 1000), 200)
  }

  const stop = () => {
    if (timerRef.current) window.clearInterval(timerRef.current)
    recorderRef.current?.stop()
  }

  const ext = mimeType.includes('mp4') ? 'm4a' : 'webm'

  return (
    <ToolShell title="在线录音机" desc="浏览器本地录音，支持暂停续录、试听与下载，音频不会上传（需授权麦克风）">
      <div className="rounded-xl border p-8 text-center">
        <div
          className={`mx-auto flex size-20 items-center justify-center rounded-full transition-all ${
            state === 'recording' ? 'animate-pulse bg-red-500/15' : 'bg-muted'
          }`}
        >
          <Mic className={`size-9 ${state === 'recording' ? 'text-red-500' : 'text-muted-foreground'}`} />
        </div>
        <p className="mt-4 font-mono text-4xl font-semibold tabular-nums">{fmtTime(seconds)}</p>
        <p className="text-muted-foreground mt-1 text-sm">
          {state === 'idle' && '准备就绪'}
          {state === 'recording' && `正在录音 · ${deviceLabel}`}
          {state === 'paused' && '已暂停'}
          {state === 'done' && '录音完成'}
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {(state === 'idle' || state === 'done') && (
            <Button onClick={() => void start()}>
              <Mic />
              {state === 'done' ? '重新录制' : '开始录音'}
            </Button>
          )}
          {state === 'recording' && (
            <>
              <Button variant="outline" onClick={pause}>
                <Pause />
                暂停
              </Button>
              <Button variant="destructive" onClick={stop}>
                <Square />
                停止
              </Button>
            </>
          )}
          {state === 'paused' && (
            <>
              <Button onClick={resume}>
                <Play />
                继续
              </Button>
              <Button variant="destructive" onClick={stop}>
                <Square />
                停止
              </Button>
            </>
          )}
          {state === 'done' && blobRef.current && (
            <Button variant="secondary" onClick={() => downloadBlob(blobRef.current!, `录音-${Date.now()}.${ext}`)}>
              <Save />
              下载录音
            </Button>
          )}
        </div>
        {error && <p className="text-destructive mt-4 text-sm">{error}</p>}
      </div>

      {devices.length > 0 && (
        <div className="mx-auto max-w-xs space-y-1.5">
          <span className="text-muted-foreground text-xs font-medium">输入设备</span>
          <SimpleSelect
            value={deviceId}
            onChange={setDeviceId}
            options={[{ deviceId: '', label: '默认麦克风' }, ...devices].map((d) => ({ value: d.deviceId, label: d.label }))}
          />
        </div>
      )}

      {audioUrl && (
        <div className="mx-auto max-w-xl space-y-2 rounded-xl border p-4">
          <span className="text-muted-foreground text-xs font-medium">试听（{mimeType || 'audio/webm'}）</span>
          <audio src={audioUrl} controls className="w-full" />
        </div>
      )}
    </ToolShell>
  )
}
