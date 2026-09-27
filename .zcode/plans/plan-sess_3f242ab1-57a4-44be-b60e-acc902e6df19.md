# 光谱工具箱 Spectrum Tools — 纯前端文件工具站（扩展版）

在 `E:\OneDrive\saves\React Taro\tools`（空目录）创建纯前端工具站：所有处理在浏览器本地完成、文件不上传。UI 复刻「光谱」设计语言。首页为工具广场（分类 + 搜索），6 大分类共 33 个工具，注册表驱动、按需懒加载引擎。

## 一、调研落地方案（原已知限制 → 解决）
1. **docx→PDF**：docx-preview 分页渲染 + html2pdf.js 栅格化导出，配预览确认步骤（说明保真度极限）
2. **音视频速度**：自托管 @ffmpeg/core（单线程）+ core-mt（多线程）；运行时检测 `crossOriginIsolated`，隔离可用时自动用 MT，否则回退单线程；仓库附 `_headers` 部署模板
3. **图片编码扩展**：jSquash 全家桶 —— AVIF/JXL 编码（浏览器原生做不到）、MozJPEG 高压缩 JPEG、OxiPNG 无损优化
4. **PDF 加密**：qpdf-wasm（AES-256 加密/解密/密码移除/文件修复）
5. **HEIC**：heic-to（libheif WASM）；**GIF**：gifuct-js + gifenc；**图片编辑**：filerobot-image-editor（MIT）；**OCR**：tesseract.js（中英，语言包浏览器缓存）

## 二、工具清单（33 个）
**格式转换（4，统一批量转换页）**：图片转换（jpg/png/webp/gif/bmp/avif/heic → png/jpg/webp/avif/jxl，质量/缩放）· 音频转换（mp3/wav/ogg/m4a/flac/opus/wma… 互转，码率/采样率）· 视频转换（mp4/webm/mkv/mov/avi… → mp4(h264)/webm/gif，分辨率/码率/帧率）· 文档转换（docx→md/html/txt/pdf；md↔html↔txt；md→docx；xlsx↔csv/json）
**PDF（10）**：合并 · 拆分（按范围/每页一文件 zip）· 页面整理（缩略图网格拖拽排序/旋转/删除）· 压缩（pdf.js 栅格化重建，DPI/质量）· 图片→PDF · PDF→图片（逐页/zip）· 加密/解密 · 加页码 · 加水印 · 元数据编辑
**GIF（4）**：视频→GIF（fps/宽度/时间范围）· GIF 拆帧（→png zip）· 图片合成 GIF（帧延迟/循环）· GIF 编辑（变速/删帧/裁剪/缩放/压缩）
**图片（6）**：图片编辑器（filerobot：裁剪/旋转/翻转/滤镜/标注）· 图片压缩（MozJPEG/OxiPNG/WebP/AVIF，前后对比）· HEIC→JPG · 批量调整尺寸 · 图片加水印（文字/图片，平铺/角落）· EXIF 查看/清除
**音视频（3）**：视频裁剪（起止时间）· 提取音频 · 音频裁剪
**更多（6）**：OCR 文字识别（中英）· 二维码生成 · 二维码识别 · 字幕转换（srt↔vtt）· 文件哈希（md5/sha1/sha256）· Base64 编解码（文件/文本）

## 三、技术栈
- **框架**：React ^19 + Vite ^8 + TypeScript + Tailwind CSS v4 + react-router-dom ^7 + zustand ^5（对齐 all-in-it 已验证组合），pnpm
- **UI**：手写 shadcn 风格组件（radix-ui 原语 + cva + clsx + tailwind-merge + tw-animate-css）、lucide-react、filerobot-image-editor
- **引擎**：@ffmpeg/ffmpeg+core(+core-mt) · @jsquash/{avif,webp,jpeg,oxipng,png,jxl} · heic-to · gifuct-js · gifenc · mammoth · docx-preview · html2pdf.js · marked · turndown · docx · papaparse · xlsx · pdf-lib · pdfjs-dist · @neslinesli93/qpdf-wasm · tesseract.js · qrcode · jsqr · exifr · hash-wasm · fflate（zip）
- **字体**：@fontsource-variable/roboto + roboto-slab（本地打包）
- 全部引擎模块按工具路由动态 import，首屏只加载 UI

## 四、设计系统（复刻光谱）
- `index.css` 逐字复刻光谱令牌：`:root`/`.dark` oklch 青绿色板（primary `oklch(0.511 0.096 186.391)`/暗色 `oklch(0.704 0.14 182.503)`）、`--radius: 0.45rem` 派生、`@theme inline` 映射、`@custom-variant dark` class 策略
- ThemeProvider：light/dark/system、localStorage、跟随系统、防抖动，顶栏 Moon/Sun 切换
- 沉浸式布局：sticky 顶栏 `h-16 bg-background/80 backdrop-blur-md border-b`（logo + 搜索 + 主题切换），内容 `max-w-6xl`，页脚隐私声明
- 玻璃卡片（半透明+backdrop-blur+发光）用于 Hero/拖放区；卡片 `rounded-2xl`、按钮胶囊、输入 `rounded-md`；加载态一律骨架屏

## 五、架构
- **工具注册表** `src/config/tools.ts`：id/分类/标题/描述/图标/接受格式/引擎入口或专属页面组件 —— 首页广场、搜索、路由、面包屑全部由此生成
- **通用批量流水线**：拖放/点选添加 → 文件列表（缩略图/大小/源格式）→ 输出与参数面板 → 顺序执行队列（zustand：status/progress/结果 Blob）→ 逐文件下载 + 全部 zip；专用工具（编辑器、PDF 整理、GIF 编辑）用专属页面但复用队列与下载组件
- **ffmpeg 单例**：懒加载 + 下载进度条（自托管 `public/ffmpeg/`，脚本从 node_modules 复制并 gitignore）；ffmpeg.progress 映射到逐文件进度
- 内存管理：及时 revoke Blob URL、队列顺序执行防内存峰值、超大文件提示
- 移动端响应式；中英文错误提示；页脚 FAQ（纯前端原理/浏览器要求/保真度说明）

## 六、实施阶段
1. 脚手架（vite/tsconfig/别名/依赖）+ 光谱令牌 + ThemeProvider + 字体
2. 基础组件 ui/ + GlassCard + ImmersiveLayout + 首页工具广场（分类卡片/搜索/骨架屏）
3. 批量转换框架（队列 store、DropZone、FileList、SettingsPanel、Progress、下载/zip）
4. 图片引擎（canvas + jSquash + heic-to）与文档引擎（mammoth/marked/turndown/docx/xlsx/papaparse）
5. ffmpeg 引擎（单例/MT 检测/进度）→ 音频/视频转换 + 视频裁剪/提音频/音频裁剪
6. PDF 工具集（10 个，含 qpdf 加解密、整理器专属页）
7. GIF 工具集（4 个，编辑器专属页）
8. 图片编辑器/压缩/缩放/水印/EXIF + 更多工具（OCR/QR/字幕/哈希/Base64）
9. 收尾：docx→PDF 预览导出、FAQ、移动端、`pnpm build` + 浏览器冒烟（png→webp、xlsx→csv、docx→md、mp3→wav、webm→gif、PDF 合并/加密、GIF 拆帧等）+ 亮暗双主题与窄屏视觉验收修复

## 七、剩余限制（页脚如实说明）
docx→PDF 为栅格化导出（文字不可选中、复杂版式有偏差）；PDF 压缩会栅格化（牺牲可搜索性，可选保守模式）；视频输出受 wasm 编码器限制（h264/vp8/9 为主）；OCR 语言包首次需下载缓存。
