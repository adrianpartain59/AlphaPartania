import { chromium } from 'playwright'

const URL = process.env.URL || 'http://localhost:5183/'

const browser = await chromium.launch({
  chromiumSandbox: false,
  args: [
    '--no-sandbox',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--use-gl=angle',
    '--use-angle=swiftshader',
  ],
})

const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
})

const errors = []
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('CONSOLE ERROR: ' + m.text())
})
page.on('pageerror', (e) => errors.push('PAGE ERROR: ' + (e.stack || e.message)))

await page.goto(URL, { waitUntil: 'load', timeout: 30000 })
await page.waitForSelector('canvas', { timeout: 15000 })
await page.waitForTimeout(7500) // loader fade + scene settle (slow headless shader compile)

await page.screenshot({ path: '.preview/hero.png' })

async function jump(progress, name) {
  await page.evaluate((p) => {
    const l = window.__lenis
    const limit = l?.limit || document.documentElement.scrollHeight - window.innerHeight
    if (l) l.scrollTo(p * limit, { immediate: true })
  }, progress)
  await page.waitForTimeout(1600) // camera damping settle
  await page.screenshot({ path: `.preview/${name}.png` })
}

await jump(0.27, 'planet1')
await jump(0.52, 'planet2')
await jump(0.78, 'planet3')
await jump(0.96, 'outro')

console.log('---ERRORS:' + errors.length + '---')
errors.forEach((e) => console.log(e))

await browser.close()
