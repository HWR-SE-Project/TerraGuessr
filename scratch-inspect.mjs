import { chromium } from 'playwright-core'

async function main() {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await ctx.newPage()
  await page.goto('http://localhost:5173/')
  await page.waitForTimeout(1500)
  const info = await page.evaluate(() => {
    const g = window.__earthDebug
    if (!g) return { error: 'no earthDebug' }
    g.updateMatrixWorld(true)
    let meshCount = 0
    let visibleCount = 0
    let materialTypes = new Set()
    let firstMeshInfo = null
    g.traverse((n) => {
      if (n.isMesh) {
        meshCount++
        if (n.visible) visibleCount++
        materialTypes.add(n.material?.type + ':' + n.material?.color?.getHexString?.())
        if (!firstMeshInfo) {
          firstMeshInfo = {
            name: n.name,
            visible: n.visible,
            matrixWorld: n.matrixWorld.elements,
            geomPosCount: n.geometry?.attributes?.position?.count,
            geomIndex: n.geometry?.index ? n.geometry.index.count : null,
            drawRange: n.geometry?.drawRange,
            hasNormal: !!n.geometry?.attributes?.normal,
            boundingSphere: n.geometry?.boundingSphere ? { radius: n.geometry.boundingSphere.radius, center: n.geometry.boundingSphere.center.toArray() } : null,
            materialTransparent: n.material?.transparent,
            materialOpacity: n.material?.opacity,
            materialVisible: n.material?.visible,
            frustumCulled: n.frustumCulled,
            renderOrder: n.renderOrder,
          }
        }
      }
    })
    return {
      meshCount,
      visibleCount,
      materialTypes: Array.from(materialTypes),
      firstMeshInfo,
      groupVisible: g.visible,
      groupParent: g.parent ? g.parent.type : null,
      groupMatrixWorld: g.matrixWorld.elements,
    }
  })
  console.log(JSON.stringify(info, null, 2))
  await browser.close()
}
main()
