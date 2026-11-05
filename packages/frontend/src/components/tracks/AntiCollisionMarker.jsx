// Planning annotation only; does not change electrical or switch geometry.
export function AntiCollisionMarker({ x, y, id }) {
  return (
    <g data-testid={`anti-collision-${id}`} transform={`translate(${x} ${y})`} pointerEvents="none">
      <title>AKS</title>
      <rect x="-36" y="-15" width="72" height="30" rx="8" fill="#166534" stroke="#dcfce7" strokeWidth="2" />
      <text textAnchor="middle" dominantBaseline="central" fontSize="21" fontWeight="bold" fill="white">
        AKS
      </text>
    </g>
  )
}
