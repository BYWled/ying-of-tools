import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChevronRight, Download, Loader2, Play, Sparkles, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { DropZone } from '@/components/converter/drop-zone'
import { FileList } from '@/components/converter/file-list'
import { SettingsPanel } from '@/components/converter/settings-panel'
import { getTool, getCategory } from '@/config/tools'
import { useQueue } from '@/stores/queue'
import { useFfmpeg } from '@/engines/ffmpeg'
import { zipResults } from '@/lib/zip'

function EngineBanner() {
  const { status, progress, mt, error } = useFfmpeg()
  if (status === 'idle') return null
  return (
    <div className="bg-muted/50 space-y-2 rounded-xl border p-3">
      {status === 'loading' && (
        <>
          <p className="flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" />
            正在加载转码引擎（{mt ? '多线程' : '单线程'}核心），仅首次需要，之后浏览器会缓存…
          </p>
          <Progress value={progress} className="h-1.5" />
        </>
      )}
      {status === 'error' && (
        <p className="text-destructive text-sm">引擎加载失败：{error}。请检查网络后刷新重试。</p>
      )}
      {status === 'ready' && (
        <p className="text-muted-foreground text-sm">
          引擎已就绪（{mt ? '多线程模式' : '单线程模式'}）
        </p>
      )}
    </div>
  )
}

export default function BatchToolPage() {
  const { toolId } = useParams()
  const tool = getTool(toolId)
  const queue = useQueue()

  useEffect(() => {
    if (tool?.batch) queue.initTool(tool.id, tool.batch)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolId])

  if (!tool) {
    return (
      <div className="py-20 text-center">
        <p className="font-heading text-2xl">没有找到这个工具</p>
        <Button asChild className="mt-6">
          <Link to="/">返回工具广场</Link>
        </Button>
      </div>
    )
  }

  if (tool.custom) {
    const Custom = tool.custom
    return <Custom />
  }

  const category = getCategory(tool.category)
  const { items, settings, fields, running, mergeMode, moduleLoading, moduleError } = queue
  const hasResults =
    items.some((i) => i.results.length > 0) || (mergeMode && queue.mergedResult && queue.mergedResult.length > 0)
  const allFiles: { name: string; blob: Blob }[] = mergeMode
    ? queue.mergedResult ?? []
    : items.flatMap((i) => i.results)
  const canRun = items.length > 0 && !running && !moduleLoading && !moduleError

  return (
    <div className="space-y-6">
      {/* 面包屑 + 标题 */}
      <div>
        <nav className="text-muted-foreground mb-3 flex items-center gap-1 text-sm">
          <Link to="/" className="hover:text-foreground">
            工具广场
          </Link>
          <ChevronRight className="size-3.5" />
          <span>{category.title}</span>
        </nav>
        <div className="flex items-start gap-4">
          <div className="bg-primary/10 text-primary flex size-12 shrink-0 items-center justify-center rounded-2xl">
            <tool.icon className="size-6" />
          </div>
          <div>
            <h1 className="font-heading text-2xl font-semibold md:text-3xl">{tool.title}</h1>
            <p className="text-muted-foreground mt-1 text-sm md:text-base">{tool.desc}</p>
          </div>
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_360px]">
        {/* 左：文件区 */}
        <div className="space-y-4">
          {items.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-muted-foreground text-sm">
                已添加 {items.length} 个文件
                {mergeMode && `（将合并为 1 个输出）`}
              </p>
              <Button variant="ghost" size="sm" disabled={running} onClick={queue.clearAll}>
                <Trash2 />
                清空
              </Button>
            </div>
          )}
          <DropZone
            accept={tool.accept}
            multiple={tool.multiple}
            onFiles={queue.addFiles}
            disabled={running}
            compact={items.length > 0}
          />
          {items.length > 0 && <FileList items={items} onRemove={queue.removeItem} />}

          {mergeMode && running && (
            <Card className="p-4">
              <p className="mb-2 text-sm">合并进度</p>
              <Progress value={queue.mergeProgress * 100} />
            </Card>
          )}
          {mergeMode && queue.mergedResult && queue.mergedResult.length > 0 && (
            <FileList
              items={[
                {
                  id: 'merged',
                  file: new File([], '合并结果'),
                  status: 'done',
                  progress: 1,
                  results: queue.mergedResult,
                },
              ]}
              onRemove={() => queue.clearAll()}
            />
          )}
        </div>

        {/* 右：设置 + 操作 */}
        <div className="space-y-4">
          <Card className="space-y-4 p-4">
            {moduleLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-9 w-full" />
              </div>
            ) : moduleError ? (
              <p className="text-destructive text-sm">{moduleError}</p>
            ) : (
              <SettingsPanel
                fields={fields}
                settings={settings}
                files={items.map((i) => i.file)}
                onChange={queue.setSetting}
              />
            )}

            {tool.needsEngine === 'ffmpeg' && <EngineBanner />}

            <Button className="w-full" size="lg" disabled={!canRun} onClick={queue.run}>
              {running ? (
                <>
                  <Loader2 className="animate-spin" />
                  处理中…
                </>
              ) : (
                <>
                  <Play />
                  {mergeMode ? '开始合并' : '开始转换'}
                </>
              )}
            </Button>

            {hasResults && (
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => zipResults(allFiles, `伴莺工具箱-${tool.id}.zip`)}
              >
                <Download />
                全部下载（{allFiles.length} 个文件）
              </Button>
            )}
          </Card>

          <div className="text-muted-foreground space-y-2 rounded-xl border border-dashed p-4 text-xs leading-relaxed">
            <p className="flex items-center gap-1.5 font-medium">
              <Sparkles className="text-primary size-3.5" />
              全程本地处理
            </p>
            <p>
              文件不会离开你的设备。批量任务按顺序逐个执行，避免大文件占满内存；关闭页面即全部丢弃。
            </p>
          </div>
        </div>
      </div>

      {/* 移动端粘性操作栏（lg 以下显示） */}
      <div className="bg-background/90 fixed inset-x-0 bottom-0 z-40 flex gap-2 border-t p-3 backdrop-blur-md lg:hidden">
        <Button
          className="flex-1"
          disabled={!canRun}
          onClick={queue.run}
        >
          {running ? (
            <>
              <Loader2 className="animate-spin" />
              处理中…
            </>
          ) : (
            <>
              <Play />
              {mergeMode ? '开始合并' : items.length > 0 ? `开始转换（${items.length}）` : '开始转换'}
            </>
          )}
        </Button>
        {hasResults && (
          <Button
            variant="secondary"
            onClick={() => zipResults(allFiles, `伴莺工具箱-${tool.id}.zip`)}
          >
            <Download />
            全部下载
          </Button>
        )}
      </div>
      {/* 给粘性栏留出空间 */}
      <div aria-hidden className="h-20 lg:hidden" />
    </div>
  )
}
