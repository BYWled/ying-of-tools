export type CategoryId = 'convert' | 'pdf' | 'image' | 'gif' | 'av' | 'more'

export interface ResultFile {
  name: string
  blob: Blob
  /** 文本类结果可在界面内直接预览 */
  preview?: string
}

export type Settings = Record<string, string | number | boolean>

export interface ConvertContext {
  /** 0 ~ 1 */
  onProgress: (p: number) => void
  signal?: AbortSignal
}

export interface FieldOption {
  value: string
  label: string
}

export interface FieldDef {
  key: string
  label: string
  type: 'select' | 'slider' | 'text' | 'password' | 'toggle'
  default: string | number | boolean
  /** select 选项；支持根据当前文件动态生成（如文档转换按源格式列出目标） */
  options?: FieldOption[] | ((files: File[]) => FieldOption[])
  min?: number
  max?: number
  step?: number
  placeholder?: string
  hint?: string
  suffix?: string
  showIf?: (s: Settings) => boolean
}

export interface ConverterModule {
  /** true = 所有文件共同产出一个结果（合并 PDF、图片合成 GIF 等） */
  mergeMode?: boolean
  fields: FieldDef[]
  /** 批量模式 files 长度为 1；merge 模式为全部文件 */
  run(files: File[], settings: Settings, ctx: ConvertContext): Promise<ResultFile[]>
}
