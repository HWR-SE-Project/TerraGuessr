import { describe, expect, it } from 'vitest'
import { ApiError } from './client'
import { mapApiError } from './errorMessages'

describe('mapApiError', () => {
  it('uses the call-site copy for a known ApiError code', () => {
    const error = new ApiError('CONFLICT', 'conflict from server', 409)
    expect(mapApiError(error, { CONFLICT: 'An account with this email already exists.' })).toBe(
      'An account with this email already exists.',
    )
  })

  it("falls back to the server's own message for an unmapped code", () => {
    const error = new ApiError('WEIRD_CODE', 'server said this', 400)
    expect(mapApiError(error, { CONFLICT: 'x' })).toBe('server said this')
  })

  it('reads the message off a plain Error', () => {
    expect(mapApiError(new Error('boom'))).toBe('boom')
  })

  it('falls back to a generic message for a non-Error throw', () => {
    expect(mapApiError('nope')).toBe('Something went wrong.')
  })
})
