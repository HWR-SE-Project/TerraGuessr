import { Component, useEffect } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { isRouteErrorResponse, useRouteError } from 'react-router-dom'
import { Icon } from '../ui/Icon'
import { LogoMark } from '../ui/Logo'

function formatDeveloperError(error: unknown): { summary: string; stack: string | null } {
  if (isRouteErrorResponse(error)) {
    const detail = typeof error.data === 'string' && error.data.trim() ? `\n${error.data}` : ''
    return {
      summary: `${error.status} ${error.statusText || 'Route Error'}${detail}`,
      stack: null,
    }
  }
  if (error instanceof Error) {
    return {
      summary: `${error.name}: ${error.message}`,
      stack: error.stack ?? null,
    }
  }
  if (typeof error === 'string') {
    return { summary: error, stack: null }
  }
  try {
    return { summary: JSON.stringify(error, null, 2) ?? String(error), stack: null }
  } catch {
    return { summary: String(error), stack: null }
  }
}

export interface ErrorScreenProps {
  variant?: 'error' | 'not-found'
  error?: unknown
  /** Defaults to `import.meta.env.DEV`; technical details are never shown in production. */
  showDetails?: boolean
  onReload?: () => void
}

/**
 * Branded, self-contained fallback screen shown when an unhandled route or
 * render error occurs. Intentionally avoids Framer Motion and React Router
 * hooks so it remains safe to render even inside the outermost error boundary.
 */
export function ErrorScreen({
  variant = 'error',
  error,
  showDetails = import.meta.env.DEV,
  onReload = () => window.location.reload(),
}: ErrorScreenProps) {
  const isNotFound = variant === 'not-found'
  const devDetails = showDetails && error !== undefined ? formatDeveloperError(error) : null

  return (
    <div
      className="relative flex min-h-dvh items-center justify-center px-4 py-10 text-cream"
      style={{
        background: 'radial-gradient(130% 100% at 50% -8%, #161a35 0%, #0a0c1e 45%, #04050b 100%)',
      }}
    >
      <main
        role="alert"
        className="surface relative w-full max-w-md p-8 text-center"
      >
        <div className="flex justify-center">
          <LogoMark size={48} />
        </div>

        <p className="eyebrow mt-5">
          {isNotFound ? '404 · Off the map' : 'Lost in orbit'}
        </p>

        <h1 className="mt-2 font-display text-2xl font-semibold text-cream sm:text-3xl">
          {isNotFound ? 'Page not found' : 'Something went wrong'}
        </h1>

        <p className="mt-3 text-pretty text-sm leading-relaxed text-muted sm:text-base">
          {isNotFound
            ? "We couldn't find that destination on our map. Head back home to start a new expedition."
            : 'We hit an unexpected snag while loading this view. Reloading the page or heading back home usually clears it up.'}
        </p>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
          {!isNotFound && (
            <button
              type="button"
              onClick={onReload}
              className="btn-base btn-press h-12 rounded-2xl border border-transparent bg-lime-400 px-5 text-[1.05rem] text-ink hover:bg-lime-300"
            >
              <Icon name="refresh" size={19} className="shrink-0" />
              Reload page
            </button>
          )}
          <a
            href="/"
            className={
              isNotFound
                ? 'btn-base btn-press h-12 rounded-2xl border border-transparent bg-lime-400 px-5 text-[1.05rem] text-ink hover:bg-lime-300'
                : 'btn-base h-12 rounded-2xl border border-white/10 bg-space-600 px-5 text-[1.05rem] text-cream shadow-card hover:bg-space-500'
            }
          >
            <Icon name="compass" size={19} className="shrink-0" />
            Back to home
          </a>
        </div>

        {devDetails && (
          <details className="surface-flat mt-6 p-3 text-left">
            <summary className="cursor-pointer font-display text-xs font-semibold uppercase tracking-wider text-rose-300">
              Developer details (dev only)
            </summary>
            <p className="mt-2 break-words font-mono text-xs text-rose-300">
              {devDetails.summary}
            </p>
            {devDetails.stack && (
              <pre className="scroll-thin mt-2 max-h-48 overflow-auto rounded-xl bg-space-950/80 p-3 font-mono text-[11px] leading-relaxed text-muted">
                {devDetails.stack}
              </pre>
            )}
          </details>
        )}
      </main>
    </div>
  )
}

/** React Router `errorElement` for all application routes. */
export function RouteErrorFallback({ showDetails }: { showDetails?: boolean } = {}) {
  const error = useRouteError()
  const isNotFound = isRouteErrorResponse(error) && error.status === 404

  useEffect(() => {
    if (!isNotFound) {
      console.error('Unhandled route error:', error)
    }
  }, [error, isNotFound])

  return (
    <ErrorScreen
      variant={isNotFound ? 'not-found' : 'error'}
      error={error}
      showDetails={showDetails}
    />
  )
}

interface RootErrorBoundaryProps {
  children: ReactNode
  showDetails?: boolean
}

interface RootErrorBoundaryState {
  hasError: boolean
  error: unknown
}

/**
 * Top-level React Error Boundary wrapping the router as a last line of defense
 * in case an error is thrown outside React Router or inside a route fallback.
 */
export class RootErrorBoundary extends Component<
  RootErrorBoundaryProps,
  RootErrorBoundaryState
> {
  state: RootErrorBoundaryState = { hasError: false, error: undefined }

  static getDerivedStateFromError(error: unknown): RootErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled application error:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorScreen
          variant="error"
          error={this.state.error}
          showDetails={this.props.showDetails}
        />
      )
    }
    return this.props.children
  }
}

interface SectionErrorBoundaryProps {
  fallback: ReactNode
  children: ReactNode
  /** Optional label logged to console when this boundary catches an error. */
  name?: string
}

interface SectionErrorBoundaryState {
  hasError: boolean
}

/**
 * Localized Error Boundary for non-critical or GPU/map widgets (3D scenes,
 * replay maps) so a crash inside one widget degrades gracefully instead of
 * taking down the whole page.
 */
export class SectionErrorBoundary extends Component<
  SectionErrorBoundaryProps,
  SectionErrorBoundaryState
> {
  state: SectionErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): SectionErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(
      this.props.name ? `Error in ${this.props.name}:` : 'Error in section:',
      error,
      info.componentStack,
    )
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children
  }
}
