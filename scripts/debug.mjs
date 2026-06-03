import { chromium } from 'playwright'

const URL = process.env.URL || 'http://localhost:5180/'
const browser = await chromium.launch({
  chromiumSandbox: false,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message))

await page.goto(URL, { waitUntil: 'load' })
await page.waitForSelector('canvas')
await page.waitForTimeout(3000)

const before = await page.evaluate(() => ({
  hasLenis: !!window.__lenis,
  limit: window.__lenis?.limit,
  scroll: window.__lenis?.scroll,
  animatedScroll: window.__lenis?.animatedScroll,
  isStopped: window.__lenis?.isStopped,
  scrollY: window.scrollY,
  docH: document.documentElement.scrollHeight,
  innerH: window.innerHeight,
}))
console.log('BEFORE:', JSON.stringify(before))

// Try Lenis programmatic jump
await page.evaluate(() => window.__lenis?.scrollTo(2000, { immediate: true }))
await page.waitForTimeout(800)
const afterLenis = await page.evaluate(() => ({ scroll: window.__lenis?.scroll, scrollY: window.scrollY }))
console.log('AFTER lenis.scrollTo(2000, immediate):', JSON.stringify(afterLenis))

// Try real wheel
await page.mouse.move(700, 450)
await page.mouse.wheel(0, 2500)
await page.waitForTimeout(1200)
const afterWheel = await page.evaluate(() => ({ scroll: window.__lenis?.scroll, scrollY: window.scrollY }))
console.log('AFTER wheel 2500:', JSON.stringify(afterWheel))

// Read the progress bar transform (reflects store.progress)
const barT = await page.evaluate(() => {
  const bar = document.querySelector('[style*="scaleX"]')
  return bar ? getComputedStyle(bar).transform : 'no-bar'
})
console.log('BAR transform:', barT)

await browser.close()
