import { formatDecimal } from '../../lib/formatDecimal'
import { useTranslation } from 'react-i18next'

/**
 * LapTime - Formatted lap time display
 * Displays times in mm:ss.SSS or ss.SSS format
 */
export default function LapTime({ time, size = 'md', highlight = false, format = 'lap', className }) {
  const { i18n } = useTranslation()
  const sizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-xl font-bold',
    xl: 'text-2xl font-bold',
  }

  // Handle null/undefined/invalid times
  if (time === null || time === undefined || time <= 0) {
    return <span className={`${sizes[size]} font-mono text-muted-foreground/50 tabular-nums`}>--</span>
  }

  // Format time from milliseconds
  const formatTime = (ms) => {
    const totalSeconds = ms / 1000

    if (format === 'total') {
      // Always show MM:SS.mmm for total race time
      const minutes = Math.floor(totalSeconds / 60)
      const seconds = totalSeconds % 60
      return `${minutes}:${formatDecimal(seconds).padStart(6, '0')}`
    }

    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60

    if (minutes >= 1) {
      // Format: "1:23.456"
      return `${minutes}:${formatDecimal(seconds).padStart(6, '0')}`
    } else {
      // Format: "23.456"
      return formatDecimal(seconds)
    }
  }

  const formattedTime = i18n.language.startsWith('de') ? formatTime(time).replace('.', ',') : formatTime(time)

  return (
    <span
      className={`
        ${sizes[size]} font-mono tabular-nums
        ${
          highlight
            ? 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 px-2 py-0.5 rounded font-bold'
            : className || 'text-foreground'
        }
      `}
    >
      {formattedTime}
    </span>
  )
}
