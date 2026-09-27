import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { PDFDocument } from 'pdf-lib'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

export async function loadPdf(file: File | Blob): Promise<PDFDocumentProxy> {
  const data = new Uint8Array(await file.arrayBuffer())
  return pdfjs.getDocument({ data, isEvalSupported: false }).promise
}

export async function pdfDocOf(file: File | Blob): Promise<PDFDocument> {
  return PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true })
}

/** 把某一页渲染到 Blob（DPI 换算：pdf 内部单位 72/inch） */
export async function renderPageToBlob(
  doc: PDFDocumentProxy,
  pageNum: number,
  opts: { dpi?: number; type?: 'image/png' | 'image/jpeg'; quality?: number } = {},
): Promise<{ blob: Blob; widthPt: number; heightPt: number }> {
  const page = await doc.getPage(pageNum)
  const scale = (opts.dpi ?? 150) / 72
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(viewport.width)
  canvas.height = Math.ceil(viewport.height)
  const ctx = canvas.getContext('2d')!
  if (opts.type === 'image/jpeg') {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }
  await page.render({ canvasContext: ctx, viewport, canvas } as never).promise
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('页面渲染失败'))),
      opts.type ?? 'image/png',
      opts.quality ?? 0.9,
    ),
  )
  const size = page.getViewport({ scale: 1 })
  return { blob, widthPt: size.width, heightPt: size.height }
}

export async function extractPdfText(
  doc: PDFDocumentProxy,
  onProgress?: (p: number) => void,
): Promise<string> {
  const parts: string[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    let lastY: number | null = null
    let text = ''
    for (const item of content.items) {
      if (!('str' in item)) continue
      const y = Math.round(item.transform[5])
      if (lastY !== null && Math.abs(y - lastY) > 2) text += '\n'
      else if (text && !text.endsWith(' ') && !text.endsWith('\n')) text += ' '
      text += item.str
      lastY = y
    }
    parts.push(text.trim())
    onProgress?.(i / doc.numPages)
  }
  return parts.join('\n\n')
}

/* ───────────────────────── qpdf（加密/解密，运行于专用 Worker） ───────────────────────── */

// WORKERFS 依赖 FileReaderSync（Worker 专属 API），qpdf 必须在 Worker 中运行
import QpdfWorker from './qpdf-worker?worker'

let worker: Worker | null = null
let seq = 0
const pending = new Map<number, { resolve: (b: Blob) => void; reject: (e: Error) => void }>()

function getWorker(): Worker {
  if (!worker) {
    worker = new QpdfWorker()
    worker.onmessage = (e: MessageEvent<{ id: number; ok: boolean; bytes?: ArrayBuffer; error?: string }>) => {
      const p = pending.get(e.data.id)
      if (!p) return
      pending.delete(e.data.id)
      if (e.data.ok && e.data.bytes) p.resolve(new Blob([e.data.bytes], { type: 'application/pdf' }))
      else p.reject(new Error(e.data.error ?? 'QPDF 处理失败'))
    }
    worker.onerror = (e) => {
      const err = new Error(`QPDF Worker 异常：${e.message || '未知错误'}`)
      for (const p of pending.values()) p.reject(err)
      pending.clear()
    }
  }
  return worker
}

/**
 * 用 QPDF 执行一次操作。input: 原始文件；args: 以 /in/input.pdf 为输入的 qpdf 参数；
 * 输出写到 /out/result.pdf 并以 Blob 返回。
 */
export async function runQpdf(input: File, args: string[]): Promise<Blob> {
  const w = getWorker()
  const id = ++seq
  const bytes = new Uint8Array(await input.arrayBuffer())
  return new Promise<Blob>((resolve, reject) => {
    pending.set(id, { resolve, reject })
    w.postMessage({ id, bytes: bytes.buffer, args }, [bytes.buffer])
  })
}
