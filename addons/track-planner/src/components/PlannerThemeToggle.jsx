import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Sun, Moon, Monitor } from 'lucide-react'
import { Button } from '@core/components/ui/button'
const modes = ['system', 'light', 'dark']
export default function PlannerThemeToggle() {
  const { t } = useTranslation('plannerIntegration')
  const embedded = window.parent !== window
  const [mode, setMode] = useState(() => {
    try {
      const saved = localStorage.getItem('carrera-planner-theme')
      return modes.includes(saved) ? saved : 'system'
    } catch {
      return 'system'
    }
  })
  useEffect(() => {
    if (embedded) return
    const media = matchMedia('(prefers-color-scheme: dark)')
    const apply = () =>
      document.documentElement.classList.toggle('dark', mode === 'dark' || (mode === 'system' && media.matches))
    apply()
    media.addEventListener('change', apply)
    try {
      localStorage.setItem('carrera-planner-theme', mode)
    } catch {
      /* Private browsing may disable storage. */
    }
    return () => media.removeEventListener('change', apply)
  }, [mode, embedded])
  if (embedded) return null
  const Icon = mode === 'dark' ? Moon : mode === 'light' ? Sun : Monitor
  const label = t('theme.change', { theme: t(`theme.${mode}`) })
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      data-testid="planner-theme-toggle"
      data-theme={mode}
      aria-label={label}
      title={label}
      onClick={() => setMode(modes[(modes.indexOf(mode) + 1) % modes.length])}
    >
      <Icon size={16} />
    </Button>
  )
}
