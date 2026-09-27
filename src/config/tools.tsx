import { lazy, type ComponentType } from 'react'
import {
  AppWindow,
  AudioLines,
  AudioWaveform,
  Binary,
  Braces,
  Camera,
  Captions,
  Clapperboard,
  Combine,
  Droplets,
  FileCog,
  FileDown,
  FileText,
  Fingerprint,
  Film,
  FolderArchive,
  Gauge,
  Images,
  LayoutGrid,
  Layers,
  ListOrdered,
  LockKeyhole,
  Music,
  Paintbrush,
  QrCode,
  Repeat,
  Scan,
  ScanSearch,
  ScanText,
  Scissors,
  Scaling,
  Stamp,
  WandSparkles,
  type LucideIcon,
} from 'lucide-react'
import type { ConverterKey } from './converters'
import type { CategoryId } from './types'

export interface CategoryDef {
  id: CategoryId
  title: string
  desc: string
  icon: LucideIcon
}

export const CATEGORIES: CategoryDef[] = [
  { id: 'convert', title: '格式转换', desc: '图片 / 音频 / 视频 / 文档，批量互转', icon: Repeat },
  { id: 'pdf', title: 'PDF 工具', desc: '合并、拆分、压缩、加密、水印、整理', icon: FileText },
  { id: 'image', title: '图片处理', desc: '编辑、压缩、缩放、水印、HEIC、EXIF', icon: Images },
  { id: 'gif', title: 'GIF 工具', desc: '拆帧、合成、编辑、视频转 GIF', icon: Film },
  { id: 'av', title: '音视频', desc: '裁剪、提取音频、压缩转码', icon: Clapperboard },
  { id: 'more', title: '更多工具', desc: 'OCR、二维码、字幕、哈希、Base64', icon: WandSparkles },
]

export interface ToolDef {
  id: string
  category: CategoryId
  title: string
  desc: string
  icon: LucideIcon
  /** 文件选择器的 accept 属性 */
  accept?: string
  multiple?: boolean
  /** 使用通用批量转换框架，指向 CONVERTERS 中的键 */
  batch?: ConverterKey
  /** 专属页面组件（懒加载） */
  custom?: ComponentType
  /** 首次使用需要下载 WASM 引擎 */
  needsEngine?: 'ffmpeg' | 'wasm'
  /** 展示用格式标签 */
  formats?: string[]
  popular?: boolean
}

const lazyPage = (loader: () => Promise<{ default: ComponentType }>) =>
  lazy(loader)

export const TOOLS: ToolDef[] = [
  // ── 格式转换 ─────────────────────────────────────────────
  {
    id: 'image-convert',
    category: 'convert',
    title: '图片格式转换',
    desc: 'JPG / PNG / WebP / AVIF / JXL / HEIC 互转，支持批量与质量调节',
    icon: Repeat,
    accept: 'image/*',
    multiple: true,
    batch: 'image.convert',
    needsEngine: 'wasm',
    formats: ['PNG', 'JPG', 'WebP', 'AVIF', 'JXL', 'GIF'],
    popular: true,
  },
  {
    id: 'audio-convert',
    category: 'convert',
    title: '音频格式转换',
    desc: 'MP3 / WAV / OGG / M4A / FLAC 等互转，可调码率与采样率',
    icon: Music,
    accept: 'audio/*,.wma,.aiff,.opus,.m4a',
    multiple: true,
    batch: 'ffmpeg.audio',
    needsEngine: 'ffmpeg',
    formats: ['MP3', 'WAV', 'OGG', 'M4A', 'FLAC'],
    popular: true,
  },
  {
    id: 'video-convert',
    category: 'convert',
    title: '视频格式转换',
    desc: 'MP4 / WebM / MKV / MOV 等互转，可调分辨率、码率、帧率',
    icon: Clapperboard,
    accept: 'video/*,.mkv,.flv,.ts,.wmv',
    multiple: true,
    batch: 'ffmpeg.video',
    needsEngine: 'ffmpeg',
    formats: ['MP4', 'WebM', 'GIF'],
    popular: true,
  },
  {
    id: 'doc-convert',
    category: 'convert',
    title: '文档格式转换',
    desc: 'DOCX → MD / HTML / TXT / PDF，Markdown 互转，Excel ↔ CSV / JSON',
    icon: FileText,
    accept: '.docx,.md,.markdown,.html,.htm,.txt,.xlsx,.xls,.csv,.json',
    multiple: true,
    batch: 'docs.convert',
    needsEngine: 'wasm',
    formats: ['DOCX', 'MD', 'HTML', 'PDF', 'XLSX', 'CSV'],
    popular: true,
  },

  // ── PDF ──────────────────────────────────────────────────
  {
    id: 'pdf-merge',
    category: 'pdf',
    title: '合并 PDF',
    desc: '将多个 PDF 按顺序合并为一个文件，可随时调整顺序',
    icon: Combine,
    accept: 'application/pdf',
    multiple: true,
    batch: 'pdf.merge',
    formats: ['PDF'],
    popular: true,
  },
  {
    id: 'pdf-split',
    category: 'pdf',
    title: '拆分 PDF',
    desc: '按页码范围拆分，或每一页导出为独立 PDF（打包下载）',
    icon: Scissors,
    accept: 'application/pdf',
    multiple: true,
    batch: 'pdf.split',
    formats: ['PDF'],
  },
  {
    id: 'pdf-organize',
    category: 'pdf',
    title: 'PDF 页面整理',
    desc: '缩略图视图下拖拽排序、旋转、删除页面，重新组织 PDF',
    icon: LayoutGrid,
    accept: 'application/pdf',
    multiple: true,
    custom: lazyPage(() => import('@/pages/custom/pdf-organize')),
  },
  {
    id: 'pdf-compress',
    category: 'pdf',
    title: '压缩 PDF',
    desc: '栅格化重建压缩体积，可选清晰度，纯本地处理',
    icon: FileDown,
    accept: 'application/pdf',
    multiple: true,
    batch: 'pdf.compress',
    needsEngine: 'wasm',
    formats: ['PDF'],
  },
  {
    id: 'image-to-pdf',
    category: 'pdf',
    title: '图片合成 PDF',
    desc: '多张图片按顺序合成一个 PDF，可选页面尺寸与边距',
    icon: Images,
    accept: 'image/*',
    multiple: true,
    batch: 'pdf.images2pdf',
    formats: ['PNG', 'JPG', 'WebP'],
  },
  {
    id: 'pdf-to-image',
    category: 'pdf',
    title: 'PDF 转图片',
    desc: '每一页导出为 PNG / JPG，可选 DPI，打包下载',
    icon: Camera,
    accept: 'application/pdf',
    multiple: true,
    batch: 'pdf.pdf2image',
    needsEngine: 'wasm',
    formats: ['PNG', 'JPG'],
  },
  {
    id: 'pdf-protect',
    category: 'pdf',
    title: 'PDF 加密 / 解密',
    desc: 'AES-256 加密或去除已知密码，基于 QPDF WASM 引擎',
    icon: LockKeyhole,
    accept: 'application/pdf',
    multiple: true,
    batch: 'pdf.protect',
    needsEngine: 'wasm',
  },
  {
    id: 'pdf-pagenum',
    category: 'pdf',
    title: 'PDF 加页码',
    desc: '为每页添加页码，可选位置、起始编号与格式',
    icon: ListOrdered,
    accept: 'application/pdf',
    multiple: true,
    batch: 'pdf.pagenum',
  },
  {
    id: 'pdf-watermark',
    category: 'pdf',
    title: 'PDF 加水印',
    desc: '平铺或居中文字水印，可调字号、透明度与角度',
    icon: Stamp,
    accept: 'application/pdf',
    multiple: true,
    batch: 'pdf.watermark',
  },
  {
    id: 'pdf-metadata',
    category: 'pdf',
    title: 'PDF 元数据编辑',
    desc: '查看并修改标题、作者、主题、关键词等文档信息',
    icon: FileCog,
    accept: 'application/pdf',
    multiple: true,
    batch: 'pdf.metadata',
  },

  // ── GIF ──────────────────────────────────────────────────
  {
    id: 'video-to-gif',
    category: 'gif',
    title: '视频转 GIF',
    desc: '截取视频片段生成 GIF，可选帧率、宽度与画质',
    icon: Film,
    accept: 'video/*,.mkv,.mov,.webm',
    multiple: true,
    batch: 'ffmpeg.video2gif',
    needsEngine: 'ffmpeg',
    formats: ['GIF'],
    popular: true,
  },
  {
    id: 'gif-frames',
    category: 'gif',
    title: 'GIF 拆帧',
    desc: '将 GIF 逐帧导出为 PNG 图片序列，打包下载',
    icon: Layers,
    accept: 'image/gif',
    multiple: true,
    batch: 'gif.split',
  },
  {
    id: 'images-to-gif',
    category: 'gif',
    title: '图片合成 GIF',
    desc: '多张图片按顺序合成动图，可设帧延迟与循环次数',
    icon: Images,
    accept: 'image/*',
    multiple: true,
    batch: 'gif.compose',
    formats: ['GIF'],
  },
  {
    id: 'gif-editor',
    category: 'gif',
    title: 'GIF 编辑器',
    desc: '变速、裁剪时间段、删除帧、缩放尺寸、重新压缩',
    icon: WandSparkles,
    accept: 'image/gif',
    custom: lazyPage(() => import('@/pages/custom/gif-editor')),
    needsEngine: 'wasm',
  },

  // ── 图片处理 ─────────────────────────────────────────────
  {
    id: 'image-editor',
    category: 'image',
    title: '图片编辑器',
    desc: '裁剪、旋转、翻转、滤镜、加标注，编辑完可另存任意格式',
    icon: Paintbrush,
    accept: 'image/*',
    custom: lazyPage(() => import('@/pages/custom/image-editor')),
    needsEngine: 'wasm',
    popular: true,
  },
  {
    id: 'image-compress',
    category: 'image',
    title: '图片压缩',
    desc: 'MozJPEG / OxiPNG / WebP / AVIF 引擎，压缩前后体积对比',
    icon: Gauge,
    accept: 'image/*',
    multiple: true,
    batch: 'image.compress',
    needsEngine: 'wasm',
    formats: ['JPG', 'PNG', 'WebP', 'AVIF'],
  },
  {
    id: 'heic-to-jpg',
    category: 'image',
    title: 'HEIC 转 JPG',
    desc: 'iPhone 照片 HEIC / HEIF 转 JPG / PNG，照片不离开设备',
    icon: Camera,
    accept: 'image/heic,image/heif,.heic,.heif',
    multiple: true,
    batch: 'image.heic',
    needsEngine: 'wasm',
    formats: ['HEIC', 'JPG', 'PNG'],
    popular: true,
  },
  {
    id: 'image-resize',
    category: 'image',
    title: '批量调整尺寸',
    desc: '按宽高、百分比或最长边缩放，可选填充方式',
    icon: Scaling,
    accept: 'image/*',
    multiple: true,
    batch: 'image.resize',
  },
  {
    id: 'image-watermark',
    category: 'image',
    title: '图片加水印',
    desc: '文字水印，可调字号、透明度、位置与平铺密度',
    icon: Droplets,
    accept: 'image/*',
    multiple: true,
    batch: 'image.watermark',
  },
  {
    id: 'exif-view',
    category: 'image',
    title: 'EXIF 查看 / 清除',
    desc: '读取照片拍摄参数，或抹除隐私信息后导出干净图片',
    icon: ScanSearch,
    accept: 'image/*',
    multiple: true,
    custom: lazyPage(() => import('@/pages/custom/exif-view')),
  },

  // ── 音视频 ───────────────────────────────────────────────
  {
    id: 'video-trim',
    category: 'av',
    title: '视频裁剪',
    desc: '截取视频的起止时间段，支持重新编码或快速流复制',
    icon: Scissors,
    accept: 'video/*,.mkv,.mov,.webm',
    multiple: true,
    batch: 'ffmpeg.trim',
    needsEngine: 'ffmpeg',
  },
  {
    id: 'extract-audio',
    category: 'av',
    title: '提取音频',
    desc: '从视频文件中提取音轨为 MP3 / WAV / M4A / FLAC',
    icon: AudioLines,
    accept: 'video/*,.mkv,.mov,.webm',
    multiple: true,
    batch: 'ffmpeg.extract',
    needsEngine: 'ffmpeg',
  },
  {
    id: 'audio-trim',
    category: 'av',
    title: '音频裁剪',
    desc: '截取音频片段并可选输出格式与码率',
    icon: AudioWaveform,
    accept: 'audio/*,.m4a,.opus,.wma',
    multiple: true,
    batch: 'ffmpeg.atrim',
    needsEngine: 'ffmpeg',
  },

  // ── 更多工具 ─────────────────────────────────────────────
  {
    id: 'ocr',
    category: 'more',
    title: '图片文字识别',
    desc: 'OCR 提取图片 / 扫描件中的文字，支持中英文',
    icon: ScanText,
    accept: 'image/*,application/pdf',
    multiple: true,
    batch: 'misc.ocr',
    needsEngine: 'wasm',
    formats: ['PNG', 'JPG', 'PDF'],
  },
  {
    id: 'qr-generate',
    category: 'more',
    title: '二维码生成',
    desc: '文本、链接生成二维码，可调尺寸与纠错等级，下载 PNG',
    icon: QrCode,
    custom: lazyPage(() => import('@/pages/custom/qr-generate')),
  },
  {
    id: 'qr-decode',
    category: 'more',
    title: '二维码识别',
    desc: '从图片中解析二维码内容，支持批量',
    icon: Scan,
    accept: 'image/*',
    multiple: true,
    batch: 'misc.qrdecode',
  },
  {
    id: 'subtitle-convert',
    category: 'more',
    title: '字幕格式转换',
    desc: 'SRT ↔ WebVTT 双向转换，也可导出纯文本',
    icon: Captions,
    accept: '.srt,.vtt,.txt',
    multiple: true,
    batch: 'misc.subtitle',
  },
  {
    id: 'file-hash',
    category: 'more',
    title: '文件哈希校验',
    desc: '计算 MD5 / SHA-1 / SHA-256 / CRC32，用于文件比对',
    icon: Fingerprint,
    accept: '*',
    multiple: true,
    batch: 'misc.hash',
  },
  {
    id: 'base64',
    category: 'more',
    title: 'Base64 编解码',
    desc: '文本与 Base64 互转，或读取任意文件生成 Data URL',
    icon: Binary,
    custom: lazyPage(() => import('@/pages/custom/base64')),
  },
  {
    id: 'zip-extract',
    category: 'more',
    title: 'ZIP 解压预览',
    desc: '纯本地解压 ZIP 压缩包，逐文件导出或打包下载，还原目录结构',
    icon: FolderArchive,
    accept: '.zip,application/zip',
    multiple: true,
    batch: 'zip.extract',
    formats: ['ZIP'],
  },
  {
    id: 'json-format',
    category: 'more',
    title: 'JSON 格式化',
    desc: '格式化 / 压缩 / 校验 JSON，可选按键名排序',
    icon: Braces,
    accept: '.json,.txt,application/json',
    multiple: true,
    batch: 'misc.json',
    formats: ['JSON'],
  },
  {
    id: 'favicon-ico',
    category: 'more',
    title: 'Favicon ICO 生成',
    desc: '任意图片一键生成多尺寸 favicon.ico（16 → 256 px，PNG-in-ICO）',
    icon: AppWindow,
    accept: 'image/*',
    multiple: true,
    batch: 'misc.favicon',
    formats: ['PNG', 'ICO'],
  },
]

export const POPULAR_TOOLS = TOOLS.filter((t) => t.popular)

/** 工具总数（供首页文案/统计使用） */
export const TOOL_COUNT = TOOLS.length
export const CATEGORY_COUNT = CATEGORIES.length

export function getTool(id: string | undefined): ToolDef | undefined {
  return TOOLS.find((t) => t.id === id)
}

export function getCategory(id: CategoryId): CategoryDef {
  return CATEGORIES.find((c) => c.id === id)!
}
