import { create } from 'zustand'
import { CONVERTERS, type ConverterKey } from '@/config/converters'
import type { ConverterModule, FieldDef, ResultFile, Settings } from '@/config/types'

export type ItemStatus = 'pending' | 'running' | 'done' | 'error'

export interface QueueItem {
  id: string
  file: File
  status: ItemStatus
  progress: number
  results: ResultFile[]
  error?: string
  /** 图片缩略图 objectURL */
  thumb?: string
}

interface QueueState {
  toolId: string
  batchKey: ConverterKey | null
  mergeMode: boolean
  moduleLoading: boolean
  moduleError?: string
  items: QueueItem[]
  settings: Settings
  fields: FieldDef[]
  running: boolean
  /** merge 模式的整体进度 */
  mergeProgress: number
  mergedResult: ResultFile[] | null

  initTool: (toolId: string, batchKey: ConverterKey) => void
  addFiles: (files: File[]) => void
  removeItem: (id: string) => void
  clearAll: () => void
  setSetting: (key: string, value: string | number | boolean) => void
  run: () => Promise<void>
}

let uid = 0
const nextId = () => `item-${Date.now()}-${uid++}`

function defaults(module: ConverterModule): Settings {
  const s: Settings = {}
  for (const f of module.fields) s[f.key] = f.default
  return s
}

export const useQueue = create<QueueState>((set, get) => ({
  toolId: '',
  batchKey: null,
  mergeMode: false,
  moduleLoading: false,
  moduleError: undefined,
  items: [],
  settings: {},
  fields: [],
  running: false,
  mergeProgress: 0,
  mergedResult: null,

  initTool: (toolId, batchKey) => {
    if (get().toolId === toolId && get().batchKey === batchKey && !get().moduleError) return
    // 撤销旧缩略图
    for (const it of get().items) if (it.thumb) URL.revokeObjectURL(it.thumb)
    set({
      toolId,
      batchKey,
      items: [],
      settings: {},
      fields: [],
      running: false,
      mergeMode: false,
      mergeProgress: 0,
      mergedResult: null,
      moduleLoading: true,
      moduleError: undefined,
    })
    CONVERTERS[batchKey]()
      .then((module) => {
        set({
          mergeMode: !!module.mergeMode,
          settings: defaults(module),
          fields: module.fields,
          moduleLoading: false,
        })
      })
      .catch((e) => {
        console.error('引擎模块加载失败', e)
        set({ moduleLoading: false, moduleError: '工具引擎加载失败，请刷新重试' })
      })
  },

  addFiles: (files) => {
    const { items } = get()
    const existing = new Set(items.map((i) => `${i.file.name}:${i.file.size}`))
    const fresh: QueueItem[] = files
      .filter((f) => !existing.has(`${f.name}:${f.size}`))
      .map((file) => ({
        id: nextId(),
        file,
        status: 'pending',
        progress: 0,
        results: [],
        thumb: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
      }))
    set({ items: [...get().items, ...fresh] })
  },

  removeItem: (id) => {
    const it = get().items.find((i) => i.id === id)
    if (it?.thumb) URL.revokeObjectURL(it.thumb)
    set({ items: get().items.filter((i) => i.id !== id) })
  },

  clearAll: () => {
    for (const it of get().items) if (it.thumb) URL.revokeObjectURL(it.thumb)
    set({ items: [], mergedResult: null, mergeProgress: 0 })
  },

  setSetting: (key, value) => set({ settings: { ...get().settings, [key]: value } }),

  run: async () => {
    const state = get()
    if (state.running || !state.batchKey) return
    const module = await CONVERTERS[state.batchKey]()
    const { mergeMode } = module

    set({ running: true, mergedResult: null, mergeProgress: 0 })

    try {
      if (mergeMode) {
        const files = state.items.map((i) => i.file)
        if (files.length === 0) return
        set((s) => ({ items: s.items.map((i) => ({ ...i, status: 'running' as const, progress: 0 })) }))
        const results = await module.run(files, get().settings, {
          onProgress: (p) => set({ mergeProgress: p }),
        })
        set((s) => ({
          items: s.items.map((i) => ({ ...i, status: 'done' as const, progress: 1 })),
          mergedResult: results,
        }))
      } else {
        // 顺序执行，避免 wasm 大文件并发导致内存峰值
        for (const item of get().items) {
          if (item.status === 'done') continue
          set((s) => ({
            items: s.items.map((i) =>
              i.id === item.id ? { ...i, status: 'running' as const, progress: 0, error: undefined } : i,
            ),
          }))
          try {
            const results = await module.run([item.file], get().settings, {
              onProgress: (p) =>
                set((s) => ({
                  items: s.items.map((i) => (i.id === item.id ? { ...i, progress: p } : i)),
                })),
            })
            set((s) => ({
              items: s.items.map((i) =>
                i.id === item.id ? { ...i, status: 'done' as const, progress: 1, results } : i,
              ),
            }))
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e)
            console.error('转换失败', item.file.name, e)
            set((s) => ({
              items: s.items.map((i) => (i.id === item.id ? { ...i, status: 'error', error: msg } : i)),
            }))
          }
        }
      }
    } finally {
      set({ running: false })
    }
  },
}))
