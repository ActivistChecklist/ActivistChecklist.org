import { describe, it, expect } from 'vitest'
import { ROUTES } from '../config/routes'

// Recursively collect all route values from the ROUTES object
function collectRoutes(obj, prefix = '') {
  const routes = []
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      routes.push({ key: prefix ? `${prefix}.${key}` : key, value })
    } else if (typeof value === 'object' && value !== null) {
      routes.push(...collectRoutes(value, prefix ? `${prefix}.${key}` : key))
    }
  }
  return routes
}

describe('Route configuration', () => {
  const allRoutes = collectRoutes(ROUTES)

  it('has routes defined', () => {
    expect(allRoutes.length).toBeGreaterThan(0)
  })

  it('all routes are strings starting with /', () => {
    for (const { key, value } of allRoutes) {
      expect(value, `Route ${key} should start with /`).toMatch(/^\//)
    }
  })

  it('has no duplicate route values', () => {
    const values = allRoutes.map(r => r.value)
    const duplicates = values.filter((v, i) => values.indexOf(v) !== i)
    expect(duplicates, `Duplicate routes found: ${duplicates.join(', ')}`).toEqual([])
  })

  it('has expected top-level keys', () => {
    expect(ROUTES.HOME).toBe('/')
    expect(ROUTES.CHANGELOG).toBeDefined()
    expect(ROUTES.NEWS).toBeDefined()
    expect(ROUTES.CHECKLISTS).toBeDefined()
    expect(ROUTES.ABOUT).toBeDefined()
  })

  it('has all expected checklist routes', () => {
    expect(ROUTES.CHECKLISTS.LIST).toBeDefined()
    expect(ROUTES.CHECKLISTS.ESSENTIALS).toBeDefined()
    expect(ROUTES.CHECKLISTS.PROTEST).toBeDefined()
    expect(ROUTES.CHECKLISTS.SIGNAL).toBeDefined()
    expect(ROUTES.CHECKLISTS.DOXXING).toBeDefined()
    expect(ROUTES.CHECKLISTS.TRAVEL).toBeDefined()
    expect(ROUTES.CHECKLISTS.EMERGENCY).toBeDefined()
    expect(ROUTES.CHECKLISTS.SECONDARY_PHONE).toBeDefined()
    expect(ROUTES.CHECKLISTS.SPYWARE).toBeDefined()
    expect(ROUTES.CHECKLISTS.RESEARCH).toBeDefined()
    expect(ROUTES.CHECKLISTS.ORGANIZER).toBeDefined()
    expect(ROUTES.CHECKLISTS.FEDERAL).toBeDefined()
    expect(ROUTES.CHECKLISTS.ACTION).toBeDefined()
  })

  it('has about sub-routes', () => {
    expect(ROUTES.ABOUT.INDEX).toBeDefined()
    expect(ROUTES.ABOUT.CONTACT).toBeDefined()
    expect(ROUTES.ABOUT.PRIVACY).toBeDefined()
  })

  it('PGP key file ends with .asc', () => {
    expect(ROUTES.PGP_KEY_FILE).toMatch(/\.asc$/)
  })
})
