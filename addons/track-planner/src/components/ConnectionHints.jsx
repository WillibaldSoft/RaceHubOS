import { useTranslation } from 'react-i18next'
import { nearestTrackConnection, openTrackPorts } from '@racehubos/shared'
export default function ConnectionHints({ plan, indices, endpointKey, onPort, width }) {
  const { t } = useTranslation('tracks')
  const ports = openTrackPorts(plan)
  const hint = indices.length && indices.length < plan.pieces.length ? nearestTrackConnection(plan, indices) : null
  return (
    <g data-testid="connection-hints">
      {ports.map((p) => (
        <g key={`${p.index}:${p.end}`}>
          <circle
            data-testid={`open-port-${p.index}-${p.end}`}
            data-connection-port="true"
            role="button"
            tabIndex="0"
            aria-label={t('tools.portLabel', { part: p.index + 1, end: t(p.end ? 'tools.end' : 'tools.start') })}
            cx={p.x}
            cy={p.y}
            r={Math.max(12, width / 100)}
            fill={endpointKey === `${p.index}:${p.end}` ? '#eab308' : '#0d9488'}
            stroke="white"
            strokeWidth="3"
            onClick={(e) => {
              e.stopPropagation()
              onPort(p, e)
            }}
            onKeyDown={(e) => {
              if (['Enter', ' '].includes(e.key)) {
                e.preventDefault()
                e.stopPropagation()
                onPort(p, e)
              }
            }}
          />
          <path
            d={`M${p.x} ${p.y} l${Math.cos(p.h) * 45} ${Math.sin(p.h) * 45}`}
            stroke="#0d9488"
            strokeWidth="5"
            pointerEvents="none"
          />
          <path
            d={`M${p.x + Math.cos(p.h) * 45} ${p.y + Math.sin(p.h) * 45} l${Math.cos(p.h + 2.6) * 18} ${Math.sin(p.h + 2.6) * 18} M${p.x + Math.cos(p.h) * 45} ${p.y + Math.sin(p.h) * 45} l${Math.cos(p.h - 2.6) * 18} ${Math.sin(p.h - 2.6) * 18}`}
            stroke="#0d9488"
            strokeWidth="4"
            pointerEvents="none"
          />
        </g>
      ))}
      {hint && (
        <g pointerEvents="none" data-testid="connection-candidate">
          <line
            x1={hint.a.x}
            y1={hint.a.y}
            x2={hint.b.x}
            y2={hint.b.y}
            stroke={hint.compatible ? '#16a34a' : '#ea580c'}
            strokeWidth="5"
            strokeDasharray="12 10"
          />
          <circle
            cx={hint.b.x}
            cy={hint.b.y}
            r="28"
            fill="none"
            stroke={hint.compatible ? '#16a34a' : '#ea580c'}
            strokeWidth="4"
          />
          <text
            x={(hint.a.x + hint.b.x) / 2}
            y={(hint.a.y + hint.b.y) / 2 - 45}
            textAnchor="middle"
            fontSize="27"
            fontWeight="bold"
            fill={hint.compatible ? '#166534' : '#9a3412'}
            stroke="white"
            strokeWidth="6"
            paintOrder="stroke"
          >
            {hint.distanceMm.toFixed(1)} mm · {hint.rotation.toFixed(1)}° ·{' '}
            {t(hint.compatible ? 'tools.aligned' : 'tools.checkDirection')}
          </text>
        </g>
      )}
    </g>
  )
}
