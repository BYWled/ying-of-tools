import type { ConverterModule } from './types'

/**
 * 批量转换器注册表：工具 id → 引擎模块（按需动态加载，首屏零开销）。
 */
export const CONVERTERS = {
  // 图片转换
  'image.convert': () => import('@/engines/image').then((m) => m.imageConvert),
  'image.compress': () => import('@/engines/image').then((m) => m.imageCompress),
  'image.heic': () => import('@/engines/image').then((m) => m.heicConvert),
  'image.resize': () => import('@/engines/image').then((m) => m.imageResize),
  'image.watermark': () => import('@/engines/image').then((m) => m.imageWatermark),

  // 文档
  'docs.convert': () => import('@/engines/docs').then((m) => m.docsConvert),

  // PDF
  'pdf.merge': () => import('@/engines/pdf-tools').then((m) => m.pdfMerge),
  'pdf.split': () => import('@/engines/pdf-tools').then((m) => m.pdfSplit),
  'pdf.compress': () => import('@/engines/pdf-tools').then((m) => m.pdfCompress),
  'pdf.images2pdf': () => import('@/engines/pdf-tools').then((m) => m.imagesToPdf),
  'pdf.pdf2image': () => import('@/engines/pdf-tools').then((m) => m.pdfToImages),
  'pdf.protect': () => import('@/engines/pdf-tools').then((m) => m.pdfProtect),
  'pdf.pagenum': () => import('@/engines/pdf-tools').then((m) => m.pdfPageNumbers),
  'pdf.watermark': () => import('@/engines/pdf-tools').then((m) => m.pdfWatermark),
  'pdf.metadata': () => import('@/engines/pdf-tools').then((m) => m.pdfMetadata),

  // ffmpeg
  'ffmpeg.audio': () => import('@/engines/ffmpeg-tools').then((m) => m.audioConvert),
  'ffmpeg.video': () => import('@/engines/ffmpeg-tools').then((m) => m.videoConvert),
  'ffmpeg.video2gif': () => import('@/engines/ffmpeg-tools').then((m) => m.videoToGif),
  'ffmpeg.trim': () => import('@/engines/ffmpeg-tools').then((m) => m.videoTrim),
  'ffmpeg.extract': () => import('@/engines/ffmpeg-tools').then((m) => m.extractAudio),
  'ffmpeg.atrim': () => import('@/engines/ffmpeg-tools').then((m) => m.audioTrim),

  // GIF
  'gif.split': () => import('@/engines/gif-tools').then((m) => m.gifSplit),
  'gif.compose': () => import('@/engines/gif-tools').then((m) => m.gifCompose),

  // 更多
  'misc.ocr': () => import('@/engines/misc').then((m) => m.ocr),
  'misc.qrdecode': () => import('@/engines/misc').then((m) => m.qrDecode),
  'misc.subtitle': () => import('@/engines/misc').then((m) => m.subtitleConvert),
  'misc.hash': () => import('@/engines/misc').then((m) => m.fileHash),
  'misc.json': () => import('@/engines/misc').then((m) => m.jsonFormat),
  'misc.favicon': () => import('@/engines/misc').then((m) => m.faviconIco),
  'zip.extract': () => import('@/engines/zip-extract').then((m) => m.zipExtract),
} satisfies Record<string, () => Promise<ConverterModule>>

export type ConverterKey = keyof typeof CONVERTERS
