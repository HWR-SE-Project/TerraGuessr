import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { PrivacyPage } from './PrivacyPage'

afterEach(() => {
  cleanup()
})

describe('PrivacyPage', () => {
  it('renders the data usage sections and links to Account and Home', () => {
    render(
      <MemoryRouter>
        <PrivacyPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'How your data is used' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'What we store' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Cookies & browser storage' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'How long data is kept' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Third-party services' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Your control' })).toBeInTheDocument()

    expect(screen.getByRole('link', { name: 'Account' })).toHaveAttribute('href', '/account')
    expect(screen.getByRole('link', { name: 'Back home' })).toHaveAttribute('href', '/')
  })
})
