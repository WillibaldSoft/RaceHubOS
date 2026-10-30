// Own SVG artwork derived from the functional layout and the user's photos.
// No manufacturer bitmap, logo, or third-party SVG is embedded.
export function UnitDetails({ segment, realistic = true }) {
  const type = segment.type
  if (!['Control_unit', 'Check_lane', 'Multistart', 'AdapterUnit'].includes(type)) return null
  const transform = `translate(${segment.start.x} ${segment.start.y}) rotate(${(segment.start.h * 180) / Math.PI})`
  const sensor = (x, y, key) => (
    <g key={key}>
      <rect x={x - 12} y={y - 14} width="24" height="28" rx="4" fill="#101113" stroke="#70777c" strokeWidth="2" />
      <circle cx={x} cy={y} r="6" fill="#351d24" stroke="#a55461" strokeWidth="1.5" />
    </g>
  )
  return (
    <g transform={transform} data-testid={`unit-detail-${segment.index}`} data-unit-kind={type}>
      {type === 'Control_unit' && (
        <>
          <path
            d="M8 -99 L0 -127 L0 -215 Q0 -234 19 -234 H326 Q345 -234 345 -215 V-127 L337 -99 Z"
            fill={realistic ? '#16191d' : '#475569'}
            stroke="#737980"
            strokeWidth="3"
          />
          <rect x="15" y="-220" width="315" height="93" rx="10" fill="#272b30" stroke="#090b0d" strokeWidth="3" />
          {Array.from({ length: 10 }, (_, i) => (
            <path key={i} d={`M${20 + i * 7} -119v-17 M${260 + i * 7} -119v-17`} stroke="#090b0d" strokeWidth="3" />
          ))}
          {[55, 102, 149, 196, 243].map((x, i) => (
            <g key={x}>
              <rect x={x - 15} y="-162" width="30" height="12" rx="4" fill="#08090a" />
              <rect x={x - 11} y="-160" width="22" height="7" rx="2" fill="#bb2638" />
              <text x={x} y="-168" fontSize="8" fill="#c8cdd2" textAnchor="middle">
                {i + 1}
              </text>
            </g>
          ))}
          {['CODE', 'SPEED', 'BRAKE', 'FUEL'].map((label, i) => (
            <g key={label}>
              <circle cx={48 + i * 57} cy="-193" r="12" fill="#0a0b0e" stroke="#777e84" strokeWidth="2" />
              <text x={48 + i * 57} y="-210" fontSize="8" fill="#e5e7eb" textAnchor="middle">
                {label}
              </text>
            </g>
          ))}
          <rect x="273" y="-207" width="42" height="28" rx="7" fill="#a62b35" stroke="#d46c73" strokeWidth="2" />
          <text x="294" y="-187" fontSize="10" fill="white" textAnchor="middle">
            START
          </text>
          {[85, 124, 163, 202].map((x) => (
            <g key={x}>
              <rect x={x - 14} y="-235" width="28" height="11" rx="2" fill="#040506" stroke="#565b60" strokeWidth="2" />
              <path d={`M${x - 8} -231h16`} stroke="#8c949b" strokeWidth="2" />
            </g>
          ))}
          <text x="172" y="-107" fontSize="12" fontWeight="bold" textAnchor="middle" fill="#e5e7eb">
            CONTROL UNIT
          </text>
          {Array.from({ length: 10 }, (_, i) => (
            <g key={i}>
              <rect x="159" y={-99 + i * 19.8} width="14" height="19.8" fill={i % 2 ? '#eee' : '#17191c'} />
              <rect x="173" y={-99 + i * 19.8} width="14" height="19.8" fill={i % 2 ? '#17191c' : '#eee'} />
            </g>
          ))}
          <text x="155" y="0" transform="rotate(-90 155 0)" fill="#eee" fontSize="11" textAnchor="middle">
            START / FINISH
          </text>
          {[-49.5, 49.5].map((y, i) => sensor(209, y, i))}
        </>
      )}
      {['Check_lane', 'Multistart'].includes(type) && (
        <>
          <path d="M165 -96v192 M180 -96v192" stroke="#eee" strokeWidth="5" />
          {[-49.5, 49.5].map((y, i) => (
            <g key={i}>
              {sensor(200, y, i)}
              <path d={`M120 ${y - 22}l27 22 -27 22z`} fill="#e5e7eb" />
            </g>
          ))}
          <rect x="162" y="-33" width="23" height="66" rx="3" fill="#2a3339" />
          <text x="176" y="0" transform="rotate(-90 176 0)" fontSize="11" fill="#e5e7eb" textAnchor="middle">
            {type === 'Multistart' ? 'MULTI' : 'CHECK'}
          </text>
        </>
      )}
      {type === 'AdapterUnit' && (
        <>
          <rect x="75" y="-157" width="195" height="58" rx="7" fill="#191d23" stroke="#747c82" strokeWidth="3" />
          {[110, 172, 234].map((x) => (
            <rect
              key={x}
              x={x - 15}
              y="-156"
              width="30"
              height="17"
              rx="3"
              fill="#07090b"
              stroke="#58616a"
              strokeWidth="2"
            />
          ))}
          <text x="173" y="-114" fill="#dce1e5" fontSize="12" textAnchor="middle">
            ADAPTER
          </text>
        </>
      )}
    </g>
  )
}
export function FuelDetail({ pose, index, article }) {
  return (
    <g
      data-testid={`fuel-detail-${index}`}
      transform={`translate(${pose.xMm} ${pose.yMm}) rotate(${pose.headingDegrees})`}
    >
      <path d="M-22 -37h44 M-22 37h44" stroke="#eceff1" strokeWidth="4" />
      {[-1, 1].map((n) => (
        <path key={n} d={`M${n * 68} -29l${-n * 35} 21v-42z`} fill="#e2e5e7" />
      ))}
      <text x="-18" y="-12" fill="#e2e5e7" fontSize="15" fontWeight="bold" textAnchor="middle">
        FUEL
      </text>
      {article && (
        <text x="-18" y="6" fill="#e2e5e7" fontSize="9" textAnchor="middle">
          {article}
        </text>
      )}
      <rect x="28" y="12" width="23" height="25" rx="3" fill="#101113" stroke="#858b91" strokeWidth="2" />
      <circle cx="40" cy="24" r="6" fill="#39202c" stroke="#bb778c" strokeWidth="2" />
    </g>
  )
}
