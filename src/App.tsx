import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { ThemeProvider } from '@/components/theme-provider'
import ImmersiveLayout from '@/layouts/immersive'
import Home from '@/pages/home'
import { Skeleton } from '@/components/ui/skeleton'

const ToolPage = lazy(() => import('@/pages/tool-page'))

function ToolFallback() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-72" />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    </div>
  )
}

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => window.scrollTo({ top: 0 }), [pathname])
  return null
}

export default function App() {
  return (
    <ThemeProvider>
      <ScrollToTop />
      <Routes>
        <Route element={<ImmersiveLayout />}>
          <Route path="/" element={<Home />} />
          <Route
            path="/tool/:toolId"
            element={
              <Suspense fallback={<ToolFallback />}>
                <ToolPage />
              </Suspense>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </ThemeProvider>
  )
}
