import { useEffect, useMemo, useRef, useState } from 'react'
import { Eye, Flag, FlagOff, Scissors } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useQueue } from '@/stores/queue'

/** 支持「秒」或「hh:mm:ss」两种格式的设置值 → 秒数 */
function parseTimeStr(v: unknown): number {
  const s = String(v ?? '').trim()
  if (!s) return NaN
  if (s.includes(':')) {
    return s.split(':').reduce((acc, p) => acc * 60 + parseFloat(p || '0'), 0)
  }
  return parseFloat(s)
}

function fmtClock(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

const VIDEO_EXT = /\.(mp4|webm|mkv|mov|avi|flv|ts|wmv|m4v)$/i

/**
 * 媒体裁剪实时预览：第一个文件用原生播放器打开，
 * 播放中一键取起止点写入设置，并可试播选中片段。
 * 适用于 video-trim / audio-trim / video-to-gif（设置键均为 start / end）。
 */
export function MediaTrimPreview() {
  const file = useQueue((s) => s.items[0]?.file)
  const settings = useQueue((s) => s.settings)
  const setSetting = useQueue((s) => s.setSetting)
  const running = useQueue((s) => s.running)

  const isVideo = !!file && (file.type.startsWith('video/') || VIDEO_EXT.test(file.name))
  const isAudio = !!file && !isVideo && (file.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|flac|opus|wma|aiff)$/i.test(file.name))
  const kind: 'video' | 'audio' | null = isVideo ? 'video' : isAudio ? 'audio' : null

  const url = useMemo(() => (file ? URL.createObjectURL(file) : ''), [file])
  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])

  const ref = useRef<HTMLVideoElement | HTMLAudioElement | null>(null)
  const [cur, setCur] = useState(0)
  const [dur, setDur] = useState(0)
  const previewingRef = useRef(false)

  // 读取当前设置里的起止点
  const startV = parseTimeStr(settings.start)
  const endV = parseTimeStr(settings.end)
  const hasStart = Number.isFinite(startV)
  const hasEnd = Number.isFinite(endV) && endV > 0

  if (!file || !kind || !url) return null

  const setPoint = (key: 'start' | 'end') => {
    const t = ref.current?.currentTime ?? 0
    setSetting(key, t.toFixed(1))
  }

  const previewSegment = async () => {
    const el = ref.current
    if (!el) return
    const from = hasStart ? startV : 0
    el.currentTime = from
    previewingRef.current = true
    try {
      await el.play()
    } catch {
      previewingRef.current = false
    }
  }

  const stopPreview = () => {
    previewingRef.current = false
    ref.current?.pause()
  }

  return (
    <div className="bg-card space-y-3 rounded-xl border p-3">
      <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
        <Eye className="size-3.5" />
        实时预览（{file.name} · 时长 {fmtClock(dur)}）
      </p>
      {kind === 'video' ? (
        <video
          ref={ref as React.RefObject<HTMLVideoElement>}
          src={url}
          controls
          preload="metadata"
          className="bg-muted max-h-72 w-full rounded-lg"
          onTimeUpdate={(e) => {
            const t = e.currentTarget.currentTime
            setCur(t)
            // 试播模式：到终点自动停
            if (previewingRef.current && hasEnd && t >= endV) {
              e.currentTarget.pause()
              previewingRef.current = false
            }
          }}
          onLoadedMetadata={(e) => setDur(e.currentTarget.duration || 0)}
        />
      ) : (
        <audio
          ref={ref as React.RefObject<HTMLAudioElement>}
          src={url}
          controls
          preload="metadata"
          className="w-full"
          onTimeUpdate={(e) => {
            const t = e.currentTarget.currentTime
            setCur(t)
            if (previewingRef.current && hasEnd && t >= endV) {
              e.currentTarget.pause()
              previewingRef.current = false
            }
          }}
          onLoadedMetadata={(e) => setDur(e.currentTarget.duration || 0)}
        />
      )}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground font-mono text-xs tabular-nums">
          当前 {fmtClock(cur)} / {fmtClock(dur)}
        </span>
        <Button variant="outline" size="sm" disabled={running} onClick={() => setPoint('start')}>
          <Flag />
          设为起点
        </Button>
        <Button variant="outline" size="sm" disabled={running} onClick={() => setPoint('end')}>
          <FlagOff />
          设为终点
        </Button>
        <Button size="sm" onClick={() => void previewSegment()}>
          <Scissors />
          试播片段{hasStart || hasEnd ? `（${fmtClock(hasStart ? startV : 0)} → ${hasEnd ? fmtClock(endV) : '结尾'}）` : ''}
        </Button>
        <Button variant="ghost" size="sm" onClick={stopPreview}>
          停止试播
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        播放到目标位置后点「设为起点 / 终点」，时间会自动填入左侧设置；留空的起点默认从头开始，终点默认到结尾。
      </p>
    </div>
  )
}
