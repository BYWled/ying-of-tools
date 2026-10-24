# 伴莺的工具箱 · Ying Tools

纯前端文件工具集：**57 个工具**，涵盖格式转换、图片编辑、GIF 处理、PDF 操作、文本处理、开发工具、OCR 识别、录音与语音等。所有处理在浏览器本地完成，**文件永不上传**。

## 线上地址

| 地址 | 部署方式 |
|---|---|
| [tools.wled.top](https://tools.wled.top) | Cloudflare Workers（连接 GitHub 自动构建） |
| [mirror-tools.wled.top](https://mirror-tools.wled.top) | GitHub Pages（GitHub Actions 自动部署） |

## 工具清单（8 大分类）

- **格式转换**：图片（PNG/JPG/WebP/AVIF/JXL/GIF/HEIC）、音频、视频、文档（DOCX/MD/HTML/XLSX/CSV/JSON/PDF）、Markdown 编辑预览
- **PDF 工具**：合并、拆分、页面整理、压缩、图片互转、加密/解密、页码、水印、元数据
- **图片处理**：编辑器、压缩（MozJPEG/OxiPNG）、HEIC 转 JPG、批量缩放、水印、EXIF、九宫格切图
- **GIF 工具**：视频转 GIF、拆帧、合成、编辑器
- **音视频**：视频/音频裁剪、提取音频、在线录音机、文字转语音
- **文本工具**：差异对比、文本统计、批量处理（去重/排序/替换）、大小写/命名转换、汉字转拼音、摩斯电码、身份证校验、字幕转换
- **开发工具**：时间戳转换、JSON 格式化、Base64、URL 编解码、进制转换、UUID、密码生成、正则测试、JWT 解码、HTML 实体、颜色转换、单位换算、文件哈希
- **更多**：OCR、二维码生成/识别、ZIP 解压、Favicon ICO

## 技术栈

React 19 · Vite · TypeScript · Tailwind CSS v4 · zustand

引擎（全部 WASM、按需懒加载）：
- **ffmpeg.wasm**：核心经多 CDN 容错下载（fastly/testingcf/jsdelivr/unpkg 依次回退）并写入 **Cache API 持久缓存**，首次成功后离线可用；多线程核心自动回退单线程
- **jSquash**（AVIF/JXL/MozJPEG/OxiPNG）· **pdf-lib / pdf.js / qpdf-wasm** · **mammoth / docx / html2pdf.js** · **tesseract.js** · **gifuct-js / gifenc** · **heic-to** · **pinyin-pro**
- 重依赖一律按分支动态 import：每个工具只下载自己需要的解析器，不互相拖累

## 开发

```bash
pnpm install   # postinstall 会将 ffmpeg wasm 引擎复制到 public/ffmpeg（不入库）
pnpm dev       # 开发服务器
pnpm build     # 类型检查 + 生产构建（产物 dist/）
```

## 部署

- **GitHub Pages**：推送 main 自动触发 `.github/workflows/deploy-pages.yml`（构建 → 404.html SPA 回退 → 部署）
- **Cloudflare Workers**：仓库连接 Cloudflare Workers Builds，构建命令 `pnpm build`，输出目录 `dist`；`public/_headers` 提供跨源隔离头（解锁 ffmpeg 多线程）
