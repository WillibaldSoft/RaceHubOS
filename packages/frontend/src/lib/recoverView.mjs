const key = 'racehubos:asset-reload-at'
const cooldown = 60000

export function isAssetLoadError(error) {
  return /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Loading chunk .* failed|Unable to preload CSS/i.test(
    error?.message || String(error)
  )
}

// An open browser can still reference chunks removed by a newer production build.
// Reload only this failure, at most once per minute, and never without a guard.
export function recoverView(error, browser = window, now = Date.now()) {
  if (!isAssetLoadError(error) || browser.navigator.onLine === false) return false
  try {
    const previous = Number(browser.sessionStorage.getItem(key))
    if (previous && now - previous < cooldown) return false
    browser.sessionStorage.setItem(key, String(now))
    browser.location.reload()
    return true
  } catch {
    return false
  }
}
