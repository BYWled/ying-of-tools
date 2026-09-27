/* 无类型声明包的本地 shim */

declare module 'gifenc' {
  export interface GifEncoderInstance {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      opts?: {
        palette?: number[][]
        delay?: number
        repeat?: number
        transparent?: boolean
        first?: boolean
        dispose?: number
      },
    ): void
    finish(): void
    bytes(): Uint8Array
    reset(): void
  }
  export function GIFEncoder(opts?: { auto?: boolean; initialCapacity?: number }): GifEncoderInstance
  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    opts?: { format?: 'rgb565' | 'rgb444' | 'rgba4444' },
  ): number[][]
  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: number[][],
    format?: string,
  ): Uint8Array
}

declare module 'html2pdf.js' {
  interface Html2PdfWorker {
    set(opt: Record<string, unknown>): Html2PdfWorker
    from(src: HTMLElement | string, type?: string): Html2PdfWorker
    outputPdf(type?: 'blob' | 'arraybuffer' | 'canvas'): Promise<Blob>
    output(type: 'blob'): Promise<Blob>
  }
  function html2pdf(): Html2PdfWorker
  export default html2pdf
}
