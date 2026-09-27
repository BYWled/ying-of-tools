# 本脚本已停用：ffmpeg wasm 核心（约 31MB）超过 Cloudflare Workers 静态资产
# 单文件 25MiB 上限，改为运行时从 jsdelivr CDN 拉取（见 src/engines/ffmpeg.ts）。
# 如需恢复自托管（例如改用 R2 托管大文件），可参考 git 历史。
console.log('[copy-ffmpeg] 已停用：引擎改由 CDN 提供（见 src/engines/ffmpeg.ts）')
