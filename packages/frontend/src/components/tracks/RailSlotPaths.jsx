// Shared rail material for main lanes, units, native pit rails and branches.
// Surface markings are painted first, so their fill never erases a slot.
export function RailSlotPaths({ paths, materialId, realistic = true, kind = 'main' }) {
  return (
    <g data-rail-slots={kind} pointerEvents="none">
      {paths.map((d, i) => (
        <g key={i}>
          {realistic ? (
            <>
              <path
                data-slot-layer="recess"
                d={d}
                fill="none"
                stroke="#08090b"
                strokeWidth="17"
                strokeLinejoin="round"
                strokeLinecap="butt"
              />
              <path
                data-slot-layer="metal"
                d={d}
                fill="none"
                stroke={`url(#${materialId}-metal)`}
                strokeWidth="10"
                strokeLinejoin="round"
                strokeLinecap="butt"
              />
              <path
                data-slot-layer="groove"
                d={d}
                fill="none"
                stroke="#101114"
                strokeWidth="3.5"
                strokeLinejoin="round"
                strokeLinecap="butt"
              />
            </>
          ) : (
            <path d={d} fill="none" stroke={i % 2 ? '#a5f3fc' : '#fbbf24'} strokeWidth="5" />
          )}
        </g>
      ))}
    </g>
  )
}
