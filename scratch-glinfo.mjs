import { chromium } from 'playwright-core'
async function main() {
  const browser = await chromium.launch()
  const page = await (await browser.newContext()).newPage()
  await page.goto('http://localhost:5173/')
  const info = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')
    const dbg = gl.getExtension('WEBGL_debug_renderer_info')
    return {
      renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      vendor: dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
      version: gl.getParameter(gl.VERSION),
    }
  })
  console.log(info)
  await browser.close()
}
main()
