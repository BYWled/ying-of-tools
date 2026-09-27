// 自托管 ffmpeg.wasm 引擎：从 node_modules 复制到 public/ffmpeg，
// 使站点不依赖任何 CDN（纯前端、可离线）。public/ffmpeg 已 gitignore。
import { cpSync, existsSync, mkdirSync, realpathSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url)) + '/..'
const dest = join(root, 'public/ffmpeg')

// @ffmpeg/core 的 exports 未暴露 package.json，直接沿 node_modules 定位并解引用 pnpm 符号链接
function pkgDir(pkg) {
  const p = join(root, 'node_modules', pkg)
  if (!existsSync(p)) return null
  return realpathSync(p)
}

// outName: st=单线程 / mt=多线程。
// 复制 ESM 构建：Vite 下 FFmpeg 以 module worker 启动（type:"module" 硬编码），
// worker 内走动态 import(coreURL) 路径，需要带 default 导出的 ESM 核心。
function copyCore(pkg, outName) {
  const dir = pkgDir(pkg)
  const src = dir && join(dir, 'dist/esm')
  if (!src || !existsSync(src)) {
    console.warn(`[copy-ffmpeg] ${pkg}/dist/esm 不存在，跳过`)
    return
  }
  const out = join(dest, outName)
  rmSync(out, { recursive: true, force: true })
  mkdirSync(out, { recursive: true })
  cpSync(src, out, { recursive: true, dereference: true })
  console.log(`[copy-ffmpeg] ${pkg} -> public/ffmpeg/${outName}`)
}

mkdirSync(dest, { recursive: true })
copyCore('@ffmpeg/core', 'st') // 单线程核心（回退方案，任何环境可用）
copyCore('@ffmpeg/core-mt', 'mt') // 多线程核心（跨源隔离时使用）

// @ffmpeg/ffmpeg 自带 worker（源文件复制进 src/vendor 由 Vite 打包，解析其相对导入）
{
  const wdir = pkgDir('@ffmpeg/ffmpeg')
  const esm = wdir && join(wdir, 'dist/esm')
  const vend = join(root, 'src/vendor/ffmpeg-worker')
  if (esm && existsSync(join(esm, 'worker.js'))) {
    rmSync(vend, { recursive: true, force: true })
    mkdirSync(vend, { recursive: true })
    for (const f of ['worker.js', 'const.js', 'errors.js']) {
      // 仅复制 .js：dist 的 .d.ts 带 `reference lib="webworker"` 会替换全项目 DOM 类型
      const src = join(esm, f)
      if (existsSync(src)) cpSync(src, join(vend, f), { dereference: true })
    }
    console.log('[copy-ffmpeg] worker -> src/vendor/ffmpeg-worker/')
  } else {
    console.warn('[copy-ffmpeg] @ffmpeg/ffmpeg esm worker 不存在')
  }
}

// 校验关键文件
for (const f of ['st/ffmpeg-core.js', 'st/ffmpeg-core.wasm']) {
  if (existsSync(join(dest, f))) {
    console.log(`[copy-ffmpeg] ✓ public/ffmpeg/${f}`)
  } else {
    console.warn(`[copy-ffmpeg] ✗ 缺少 public/ffmpeg/${f}（音视频工具将回退 CDN 加载）`)
  }
}
