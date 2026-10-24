import { useMemo, useRef, useState } from 'react'
import { Volume2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CopyButton, ErrorText, TextArea, ToolShell } from '@/components/tool-shell'

const LETTERS = `A .-|B -...|C -.-.|D -..|E .|F ..-.|G --.|H ....|I ..|J .---|K -.-|L .-..|M --|N -.|O ---|P .--.|Q --.-|R .-.|S ...|T -|U ..-|V ...-|W .--|X -..-|Y -.--|Z --..
0 -----|1 .----|2 ..---|3 ...--|4 ....-|5 .....|6 -....|7 --...|8 ---..|9 ----.
. .-.-.-|, --..--|? ..--..|! -.-.--|' .----|" .-..-.|/ -..-.|( -.--.|) -.--.-|& .-...|: ---...|; -.-.-.|= -...-|+ .-.-|- -....-|_ ..--.-|$ ...-..-|@ .--.-.`

const TO_MORSE = new Map<string, string>()
const FROM_MORSE = new Map<string, string>()
for (const entry of LETTERS.split(/[|\n]/)) {
  const [ch, code] = entry.split(' ')
  if (ch && code) {
    TO_MORSE.set(ch, code)
    FROM_MORSE.set(code, ch)
  }
}

function encodeMorse(text: string): string {
  return [...text.toUpperCase()]
    .map((ch) => (ch === ' ' ? '/' : TO_MORSE.get(ch) ?? ''))
    .filter(Boolean)
    .join(' ')
}

function decodeMorse(morse: string): string {
  return morse
    .trim()
    .split(/\s*\/\s*/)
    .map((word) =>
      word
        .split(/\s+/)
        .filter(Boolean)
        .map((c) => FROM_MORSE.get(c) ?? '')
        .join(''),
    )
    .join(' ')
}

export default function MorsePage() {
  const [text, setText] = useState('SOS 你好')
  const [out, setOut] = useState('')
  const [err, setErr] = useState('')
  const audioRef = useRef<AudioContext | null>(null)

  const unknownChars = useMemo(() => [...text.toUpperCase()].filter((c) => c !== ' ' && !TO_MORSE.has(c) && /[\u4e00-\u9fff]/.test(c)), [text])

  const play = async () => {
    const code = out || encodeMorse(text)
    if (!code) return
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = audioRef.current ?? new AC()
    audioRef.current = ctx
    if (ctx.state === 'suspended') await ctx.resume()
    const DOT = 70
    let t = ctx.currentTime + 0.1
    for (const sym of code.replace(/\//g, '')) {
      if (sym === '.') {
        beep(ctx, t, DOT)
        t += DOT * 2
      } else if (sym === '-') {
        beep(ctx, t, DOT * 3)
        t += DOT * 4
      } else {
        t += DOT * 2
      }
    }
  }

  return (
    <ToolShell title="摩斯电码转换" desc="文本与摩斯电码双向转换，可用 Web Audio 试听电码声音（中文不支持，会自动忽略）">
      <div className="rounded-xl border p-4">
        <div className="mb-3 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => { setErr(''); setOut(encodeMorse(text)) }}>
            编码 → 电码
          </Button>
          <Button size="sm" variant="outline" onClick={() => { setErr(''); setOut(decodeMorse(text)) }}>
            解码 → 文本
          </Button>
          <Button size="sm" variant="outline" onClick={() => void play()}>
            <Volume2 />
            试听电码
          </Button>
        </div>
        <div className="space-y-1.5">
          <span className="text-muted-foreground text-xs font-medium">输入</span>
          <TextArea value={text} onChange={setText} rows={4} placeholder="输入文本（编码）或电码如 ... --- ...（解码）" />
        </div>
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs font-medium">输出</span>
            <CopyButton text={out} />
          </div>
          <TextArea value={out} readOnly rows={4} />
        </div>
        <ErrorText>{err}</ErrorText>
        {unknownChars.length > 0 && (
          <p className="text-muted-foreground mt-2 text-xs">提示：摩斯电码只覆盖英文字母与数字，中文字符将被忽略。</p>
        )}
      </div>
    </ToolShell>
  )
}

function beep(ctx: AudioContext, at: number, dur: number) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.frequency.value = 620
  osc.type = 'sine'
  gain.gain.setValueAtTime(0.0001, at)
  gain.gain.exponentialRampToValueAtTime(0.25, at + 0.01)
  gain.gain.setValueAtTime(0.25, at + dur / 1000 - 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur / 1000)
  osc.connect(gain).connect(ctx.destination)
  osc.start(at)
  osc.stop(at + dur / 1000 + 0.02)
}
