// 构建前生成：把 @ffmpeg/ffmpeg 的 ESM worker 源文件复制到 src/vendor/ffmpeg-worker，
// 供 Vite 以 ?worker&url 打包（解析其相对导入）。此目录已 gitignore，每次构建重新生成。
// （ffmpeg wasm 核心已改为运行时从 CDN 拉取，见 src/engines/ffmpeg.ts）
import { cpSync, existsSync, mkdirSync, realpathSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url)) + '/..'
const vend = join(root, 'src/vendor/ffmpeg-worker')

function pkgDir(pkg) {
  const p = join(root, 'node_modules', pkg)
  if (!existsSync(p)) return null
  return realpathSync(p)
}

const dir = pkgDir('@ffmpeg/ffmpeg')
const src = dir && join(dir, 'dist/esm')
if (src && existsSync(src)) {
  rmSync(vend, { recursive: true, force: true })
  mkdirSync(vend, { recursive: true })
  for (const f of ['worker.js', 'const.js', 'errors.js']) {
    if (existsSync(join(src, f))) cpSync(join(src, f), join(vend, f), { dereference: true })
  }
  console.log('[copy-ffmpeg] worker -> src/vendor/ffmpeg-worker/')
} else {
  console.error('[copy-ffmpeg] 未找到 @ffmpeg/ffmpeg，请先 pnpm install')
  process.exit(1)
}
