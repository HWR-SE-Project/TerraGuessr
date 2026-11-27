import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ErrorScreen, RootErrorBoundary, RouteErrorFallback, SectionErrorBoundary } from './ErrorFallback'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function ThrowingComponent({ message }: { message: string }): never {
  throw new Error(message)
}

describe('ErrorScreen', () => {
  it('hides error message and stack trace when showDetails is false (production)', () => {
    const error = new Error('SECRET_INTERNAL_FAILURE_42')
    error.stack = 'Error: SECRET_INTERNAL_FAILURE_42\n    at secretChunk.js:12:34'
    const onReload = vi.fn()

    render(<ErrorScreen error={error} showDetails={false} onReload={onReload} />)

    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument()
    expect(screen.queryByText(/SECRET_INTERNAL_FAILURE_42/)).not.toBeInTheDocument()
    expect(screen.queryByText(/secretChunk\.js/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Developer details/i)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/')
  })

  it('calls onReload when the user clicks Reload page', async () => {
    const user = userEvent.setup()
    const onReload = vi.fn()

    render(<ErrorScreen showDetails={false} onReload={onReload} />)
    await user.click(screen.getByRole('button', { name: 'Reload page' }))

    expect(onReload).toHaveBeenCalledTimes(1)
  })

  it('shows collapsible developer details when showDetails is true', () => {
    const error = new Error('Broken widget state')
    error.stack = 'Error: Broken widget state\n    at BrokenWidget.tsx:88:12'

    render(<ErrorScreen error={error} showDetails={true} />)

    expect(screen.getByText(/Developer details/i)).toBeInTheDocument()
    expect(screen.getByText('Error: Broken widget state')).toBeInTheDocument()
    expect(screen.getByText(/BrokenWidget\.tsx:88:12/)).toBeInTheDocument()
  })

  it('renders a dedicated not-found state without a reload button', () => {
    render(<ErrorScreen variant="not-found" showDetails={false} />)

    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reload page' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/')
  })
})

describe('RouteErrorFallback', () => {
  it('catches route render errors without leaking the stack trace in production mode', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const router = createMemoryRouter(
      [
        {
          errorElement: <RouteErrorFallback showDetails={false} />,
          children: [
            { path: '/', element: <ThrowingComponent message="BOOM_ROUTE_CRASH" /> },
          ],
        },
      ],
      { initialEntries: ['/'] },
    )

    render(<RouterProvider router={router} />)

    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument()
    expect(screen.queryByText(/BOOM_ROUTE_CRASH/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Unexpected Application Error/i)).not.toBeInTheDocument()
  })

  it('renders the 404 view for a 404 route error response', () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          element: <Outlet />,
          errorElement: <RouteErrorFallback showDetails={false} />,
          children: [{ path: 'known', element: <div>Known</div> }],
        },
      ],
      { initialEntries: ['/missing'] },
    )

    render(<RouterProvider router={router} />)

    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
  })
})

describe('RootErrorBoundary', () => {
  it('catches uncaught React tree errors and hides stack traces in production mode', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <RootErrorBoundary showDetails={false}>
        <ThrowingComponent message="TOP_LEVEL_CRASH" />
      </RootErrorBoundary>,
    )

    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument()
    expect(screen.queryByText(/TOP_LEVEL_CRASH/)).not.toBeInTheDocument()
  })
})

describe('SectionErrorBoundary', () => {
  it('renders the localized fallback without crashing the rest of the page', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <div>
        <h1>Page stays alive</h1>
        <SectionErrorBoundary name="TestWidget" fallback={<p>Widget unavailable</p>}>
          <ThrowingComponent message="WIDGET_CRASH" />
        </SectionErrorBoundary>
      </div>,
    )

    expect(screen.getByRole('heading', { name: 'Page stays alive' })).toBeInTheDocument()
    expect(screen.getByText('Widget unavailable')).toBeInTheDocument()
    expect(screen.queryByText(/WIDGET_CRASH/)).not.toBeInTheDocument()
  })
})
