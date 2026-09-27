// 生成 GUI 冒烟测试用的样例文件（仅测试用，可随时删除）
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'test-fixtures')
mkdirSync(out, { recursive: true })

/* ── PNG：64x64 青绿色方块 ── */
function crc32(buf) {
  let table = crc32.table
  if (!table) {
    table = crc32.table = new Int32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      table[n] = c
    }
  }
  let crc = -1
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff]
  return (crc ^ -1) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}
const W = 64
const H = 64
const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(W, 0)
ihdr.writeUInt32BE(H, 4)
ihdr[8] = 8 // bit depth
ihdr[9] = 2 // truecolor
const raw = Buffer.alloc(H * (1 + W * 3))
for (let y = 0; y < H; y++) {
  raw[y * (1 + W * 3)] = 0
  for (let x = 0; x < W; x++) {
    const o = y * (1 + W * 3) + 1 + x * 3
    raw[o] = 31
    raw[o + 1] = 142
    raw[o + 2] = 131
  }
}
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw)),
  chunk('IEND', Buffer.alloc(0)),
])
writeFileSync(join(out, 'sample.png'), png)

/* ── WAV：1 秒 440Hz 正弦 ── */
const sr = 8000
const n = sr
const dataBuf = Buffer.alloc(n * 2)
for (let i = 0; i < n; i++) {
  dataBuf.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 440 * i) / sr) * 8000), i * 2)
}
const header = Buffer.alloc(44)
header.write('RIFF', 0)
header.writeUInt32LE(36 + dataBuf.length, 4)
header.write('WAVEfmt ', 8)
header.writeUInt32LE(16, 16)
header.writeUInt16LE(1, 20)
header.writeUInt16LE(1, 22)
header.writeUInt32LE(sr, 24)
header.writeUInt32LE(sr * 2, 28)
header.writeUInt16LE(2, 32)
header.writeUInt16LE(16, 34)
header.write('data', 36)
header.writeUInt32LE(dataBuf.length, 40)
writeFileSync(join(out, 'sample.wav'), Buffer.concat([header, dataBuf]))

/* ── PDF ×2：pdf-lib 生成 ── */
const { PDFDocument, StandardFonts } = require('pdf-lib')
async function makePdf(text, name) {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const page = doc.addPage([400, 200])
  page.drawText(text, { x: 40, y: 100, size: 24, font })
  const bytes = await doc.save()
  writeFileSync(join(out, name), Buffer.from(bytes))
}
await makePdf('Part One - Banying', 'part1.pdf')
await makePdf('Part Two - Banying', 'part2.pdf')

/* ── XLSX：SheetJS 生成 ── */
const XLSX = require('xlsx')
const wb = XLSX.utils.book_new()
const ws = XLSX.utils.json_to_sheet([
  { name: '伴莺', role: 'owner', level: 99 },
  { name: 'spectrum', role: 'design', level: 42 },
])
XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
writeFileSync(join(out, 'sample.xlsx'), XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' }))

/* ── MD / CSV ── */
writeFileSync(
  join(out, 'sample.md'),
  `# 伴莺的工具箱\n\n**纯前端**文件工具集，支持 *批量转换*。\n\n- 本地处理\n- 不上传\n\n> 隐私是底线\n`,
)
writeFileSync(join(out, 'sample.csv'), 'id,name,score\n1,alpha,90\n2,beta,85\n')

/* ── GIF：gifenc 生成 3 帧 ── */
const { GIFEncoder, quantize, applyPalette } = require('gifenc')
const gw = 32
const gh = 32
const gif = GIFEncoder()
for (let f = 0; f < 3; f++) {
  const rgba = new Uint8Array(gw * gh * 4)
  for (let i = 0; i < gw * gh; i++) {
    rgba[i * 4] = f === 0 ? 200 : 30
    rgba[i * 4 + 1] = 140 + f * 30
    rgba[i * 4 + 2] = 130
    rgba[i * 4 + 3] = 255
  }
  const palette = quantize(rgba, 4)
  const index = applyPalette(rgba, palette)
  gif.writeFrame(index, gw, gh, { palette, delay: 100, repeat: 0, first: f === 0 })
}
gif.finish()
writeFileSync(join(out, 'sample.gif'), Buffer.from(gif.bytes()))

console.log('fixtures written to', out)

/* ── 追加：DOCX / QR / SRT / 三帧 PNG ── */
const { Document, Packer, Paragraph, HeadingLevel, TextRun } = require('docx')
const docxDoc = new Document({
  sections: [{
    children: [
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('伴莺测试文档')] }),
      new Paragraph({ children: [new TextRun('这是第一段正文，用于验证 DOCX 转换。')] }),
      new Paragraph({ text: '第二个段落，包含更多文字内容。' }),
    ],
  }],
})
writeFileSync(join(out, 'sample.docx'), await Packer.toBuffer(docxDoc))

const QRCode = require('qrcode')
await QRCode.toFile(join(out, 'sample-qr.png'), 'https://banying.example/toolbox', { width: 240, margin: 2 })

writeFileSync(
  join(out, 'sample.srt'),
  '1\n00:00:01,000 --> 00:00:03,500\n你好，伴莺\n\n2\n00:00:04,000 --> 00:00:06,000\n纯前端字幕转换测试\n',
)

// 三帧不同色的 PNG（供图片合成 GIF）
function makePng(r, g, b, name) {
  const raw2 = Buffer.alloc(H * (1 + W * 3))
  for (let y = 0; y < H; y++) {
    raw2[y * (1 + W * 3)] = 0
    for (let x = 0; x < W; x++) {
      const o = y * (1 + W * 3) + 1 + x * 3
      raw2[o] = r; raw2[o + 1] = g; raw2[o + 2] = b
    }
  }
  const png2 = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw2)),
    chunk('IEND', Buffer.alloc(0)),
  ])
  writeFileSync(join(out, name), png2)
}
makePng(220, 60, 60, 'frame1.png')
makePng(60, 200, 90, 'frame2.png')
makePng(70, 110, 220, 'frame3.png')

console.log('extra fixtures done')
