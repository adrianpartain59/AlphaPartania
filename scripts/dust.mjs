import { chromium } from 'playwright'

const URL = process.env.URL || 'http://localhost:5184/'
const browser = await chromium.launch({
  chromiumSandbox: false,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message))

await page.goto(URL, { waitUntil: 'load' })
await page.waitForSelector('canvas')
await page.waitForTimeout(3500)

// Sit at planet 1 focus, where the camera is right inside a dust belt.
await page.evaluate(() => {
  const l = window.__lenis
  if (l) l.scrollTo(0.27 * (l.limit || 3000), { immediate: true })
})
await page.waitForTimeout(1800)

// Park the cursor off to the side first (let the belt settle), then screenshot.
await page.mouse.move(1200, 760)
await page.waitForTimeout(1200)
await page.screenshot({ path: '.preview/dust-before.png' })

// Sweep the cursor through the dense foreground dust and hold.
for (let x = 1200; x >= 560; x -= 40) {
  await page.mouse.move(x, 700)
  await page.waitForTimeout(16)
}
await page.mouse.move(560, 700)
await page.waitForTimeout(250)
await page.screenshot({ path: '.preview/dust-after.png' })

await browser.close()
console.log('done')
