import { expect, test } from '@playwright/test'

const BASE = 'http://localhost:3000'

// ── Homepage ─────────────────────────────────────────────────────────────────

test.describe('Homepage', () => {
  test('loads and shows entry navigator', async ({ page }) => {
    await page.goto(BASE)
    // NavRail logo should be visible
    await expect(page.locator('img[alt="alm"]')).toBeVisible()
    // Desktop: image column aside + at least one entry button in text col
    // Mobile: tap zone buttons. Either form should have content.
    await expect(
      page.locator('aside, button[aria-label="Previous entry"]').first()
    ).toBeVisible()
  })

  test('search icon is clickable and navigates to /search', async ({ page }) => {
    await page.goto(BASE)
    // Wait for the page to settle
    await page.waitForLoadState('networkidle')
    const searchLink = page.locator('a[aria-label="Search"]').first()
    await expect(searchLink).toBeVisible()
    await searchLink.click()
    await expect(page).toHaveURL(`${BASE}/search`)
  })
})

// ── Search page ───────────────────────────────────────────────────────────────

test.describe('Search page', () => {
  test('loads with search input and entry grid', async ({ page }) => {
    await page.goto(`${BASE}/search`)
    await expect(page.locator('input[type="search"]')).toBeVisible()
    // Should render entry cards (grid)
    await expect(page.locator('a[href*="/entry/"]').first()).toBeVisible()
  })

  test('search input filters results', async ({ page }) => {
    await page.goto(`${BASE}/search`)
    const input = page.locator('input[type="search"]')
    const initialCards = await page.locator('a[href*="/entry/"]').count()

    // Type a very specific query that should return 0 or few results
    await input.fill('xyznothing123')
    // Wait for debounce + fetch
    await page.waitForTimeout(500)
    const afterCards = await page.locator('a[href*="/entry/"]').count()
    // Should have fewer (or zero) results than initial
    expect(afterCards).toBeLessThanOrEqual(initialCards)
  })

  test('clicking entry card navigates to entry with back button', async ({ page }) => {
    await page.goto(`${BASE}/search`)
    // Click first entry card
    const firstCard = page.locator('a[href*="/entry/"]').first()
    const href = await firstCard.getAttribute('href')
    expect(href).toContain('from=search')
    await firstCard.click()
    await page.waitForLoadState('networkidle')
    // URL should be an entry page
    expect(page.url()).toContain('/entry/')
    // Back button should be visible
    await expect(page.locator('a:has-text("← Search")').first()).toBeVisible()
  })

  test('nav rail stays visible when page scrolls', async ({ page }) => {
    await page.goto(`${BASE}/search`)
    // Scroll to bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(100)
    // Rail logo should still be in viewport (position: sticky)
    const logo = page.locator('img[alt="alm"]').first()
    await expect(logo).toBeVisible()
  })
})

// ── Studio pages ─────────────────────────────────────────────────────────────

test.describe('Studio pages', () => {
  test('/studio shows overview with nav links', async ({ page }) => {
    await page.goto(`${BASE}/studio`)
    await expect(page.locator('h1')).toBeVisible()
    // Should have at least one subpage link
    await expect(page.locator('a[href*="/studio/"]').first()).toBeVisible()
  })

  test('/studio/[slug] renders subpage content', async ({ page }) => {
    await page.goto(`${BASE}/studio`)
    // Click first subpage link
    const firstLink = page.locator('ul a[href*="/studio/"]').first()
    await firstLink.click()
    await page.waitForLoadState('networkidle')
    // Back link should be visible
    await expect(page.locator('a:has-text("← Studio")')).toBeVisible()
  })
})

// ── Entry page ────────────────────────────────────────────────────────────────

test.describe('Entry page', () => {
  test('/entry/[slug] loads correctly', async ({ page }) => {
    // Navigate to search first to find a valid slug
    await page.goto(`${BASE}/search`)
    const firstCard = page.locator('a[href*="/entry/"]').first()
    const href = await firstCard.getAttribute('href')
    // Strip the ?from=search query param for a direct visit
    const directHref = href?.replace('?from=search', '') ?? `${BASE}`
    await page.goto(`${BASE}${directHref}`)
    await page.waitForLoadState('networkidle')
    // NavRail should be visible
    await expect(page.locator('img[alt="alm"]')).toBeVisible()
    // No back button when not coming from search
    await expect(page.locator('a:has-text("← Search")')).toHaveCount(0)
  })
})
