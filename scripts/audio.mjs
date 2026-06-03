import { chromium } from 'playwright'

const URL = process.env.URL || 'http://localhost:5187/'
const browser = await chromium.launch({
  chromiumSandbox: false,
  args: [
    '--no-sandbox',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--autoplay-policy=no-user-gesture-required',
    '--mute-audio',
  ],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('CONSOLE ERROR: ' + m.text())
})
page.on('pageerror', (e) => errors.push('PAGE ERROR: ' + (e.stack || e.message)))

await page.goto(URL, { waitUntil: 'load' })
await page.waitForSelector('canvas')
await page.waitForTimeout(7500)

const barT = () =>
  page.evaluate(() => {
    const bar = document.querySelector('[style*="scaleX"]')
    return bar ? getComputedStyle(bar).transform : 'n/a'
  })

const muteLabel = () =>
  page.evaluate(() => {
    const b = document.querySelector('[aria-label="Mute audio"],[aria-label="Unmute audio"]')
    return b ? b.getAttribute('aria-label') : 'missing'
  })

console.log('present next:', !!(await page.$('[aria-label="Next project"]')))
console.log('present prev:', !!(await page.$('[aria-label="Previous project"]')))
console.log('present mute:', await muteLabel())
console.log('progress @overview:', await barT())

await page.screenshot({ path: '.preview/audio-hero.png' })

await page.click('[aria-label="Next project"]')
await page.waitForTimeout(1600)
console.log('progress after NEXT x1:', await barT())
await page.screenshot({ path: '.preview/audio-next1.png' })

await page.click('[aria-label="Next project"]')
await page.waitForTimeout(1600)
console.log('progress after NEXT x2:', await barT())

await page.click('[aria-label="Previous project"]')
await page.waitForTimeout(1600)
console.log('progress after PREV x1:', await barT())

await page.click('[aria-label="Mute audio"]')
await page.waitForTimeout(300)
console.log('mute label after click:', await muteLabel())

console.log('---ERRORS:' + errors.length + '---')
errors.forEach((e) => console.log(e))
await browser.close()
