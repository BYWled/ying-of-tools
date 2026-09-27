# 伴莺的工具箱 · Ying Tools

纯前端文件工具集：**36 个工具**，涵盖格式转换、图片编辑、GIF 处理、PDF 操作、OCR 识别等。所有处理在浏览器本地完成，**文件永不上传**。

## 线上地址

| 地址 | 部署方式 |
|---|---|
| [tools.wled.top](https://tools.wled.top) | Cloudflare Workers（连接 GitHub 自动构建） |
| [mirror-tools.wled.top](https://mirror-tools.wled.top) | GitHub Pages（GitHub Actions 自动部署） |

## 工具清单（6 大分类）

- **格式转换**：图片（PNG/JPG/WebP/AVIF/JXL/GIF/HEIC）、音频、视频、文档（DOCX/MD/HTML/XLSX/CSV/JSON/PDF）
- **PDF 工具**：合并、拆分、页面整理、压缩、图片互转、加密/解密、页码、水印、元数据
- **图片处理**：编辑器、压缩（MozJPEG/OxiPNG）、HEIC 转 JPG、批量缩放、水印、EXIF
- **GIF 工具**：视频转 GIF、拆帧、合成、编辑器
- **音视频**：裁剪、提取音频
- **更多**：OCR、二维码生成/识别、字幕转换、文件哈希、Base64、ZIP 解压、JSON 格式化、Favicon ICO

## 技术栈

React 19 · Vite · TypeScript · Tailwind CSS v4 · zustand

引擎（全部 WASM、按需懒加载）：ffmpeg.wasm（自托管，多线程自动回退单线程）· jSquash（AVIF/JXL/MozJPEG/OxiPNG）· pdf-lib / pdf.js / qpdf-wasm · mammoth / docx-preview / html2pdf.js · tesseract.js · gifuct-js / gifenc · heic-to

## 开发

```bash
pnpm install   # postinstall 会将 ffmpeg wasm 引擎复制到 public/ffmpeg（不入库）
pnpm dev       # 开发服务器
pnpm build     # 类型检查 + 生产构建（产物 dist/）
```

## 部署

- **GitHub Pages**：推送 main 自动触发 `.github/workflows/deploy-pages.yml`（构建 → 404.html SPA 回退 → 部署）
- **Cloudflare Workers**：仓库连接 Cloudflare Workers Builds，构建命令 `pnpm build`，输出目录 `dist`；`public/_headers` 提供跨源隔离头（解锁 ffmpeg 多线程）
