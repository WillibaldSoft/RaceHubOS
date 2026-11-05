// Fit the complete footprint to the actual drawing area, including its aspect
// ratio. UI panels may resize independently; they must never crop the plan.
export function trackViewport(bounds, viewport, zoom = 1, pan = { x: 0, y: 0 }) {
  const aspect = Math.max(1, viewport.width) / Math.max(1, viewport.height)
  let width = Math.max(600, bounds.width + 200)
  let height = Math.max(400, bounds.depth + 200)
  if (width / height < aspect) width = height * aspect
  else height = width / aspect
  width /= zoom
  height /= zoom
  return [
    bounds.x + bounds.width / 2 - width / 2 + pan.x,
    bounds.y + bounds.depth / 2 - height / 2 + pan.y,
    width,
    height,
  ]
}
