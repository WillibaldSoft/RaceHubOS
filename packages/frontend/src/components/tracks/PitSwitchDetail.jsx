import { RailSlotPaths } from './RailSlotPaths'

// Original vector detail. Native SBP modules use a centred local frame and
// run in the opposite direction to the standalone, start-anchored rail.
export function PitSwitchDetail({ entry, pose, materialId, realistic = true, native = false, surface = false }) {
  const branch = entry ? 'M0 49.5 C115 49.5 230 148.5 345 148.5' : 'M0 148.5 C115 148.5 230 49.5 345 49.5'
  const transform = native ? 'translate(172.5 99) rotate(180)' : ''
  return (
    <g
      transform={`translate(${pose.xMm} ${pose.yMm}) rotate(${pose.headingDegrees})`}
      data-switch-kind={entry ? 'active-entry' : 'passive-merge'}
      data-pit-switch-detail={entry ? 'active-entry' : 'passive-merge'}
    >
      <g transform={transform}>
        {surface && (
          <>
            <path d={branch} fill="none" stroke="#111315" strokeWidth="102" />
            <path
              d={branch}
              fill="none"
              stroke={realistic ? `url(#${materialId}-surface)` : '#374151'}
              strokeWidth="99"
            />
            <RailSlotPaths paths={[branch]} materialId={materialId} realistic={realistic} kind="pit-branch" />
          </>
        )}
        {!native && <path d="M0 -99V99 M345 -99V198" fill="none" stroke="#7b8085" strokeWidth="2" />}
        {entry ? (
          <g data-pit-actuator="true">
            <path d="M18 49.5 L70 47 L70 51 Z" fill="#e1e5e8" stroke="#4b5157" strokeWidth="1.5" />
            <rect x="80" y="65" width="17" height="13" rx="2" fill="#101214" stroke="#9ca3af" strokeWidth="2" />
            <path d="M83 71H94" stroke="#c5cbd0" strokeWidth="2" />
          </g>
        ) : (
          <g data-pit-fixed-merge="true">
            <path d="M279 47 L325 49.5 L279 52" fill="#989fa5" stroke="#17191c" strokeWidth="1.5" />
          </g>
        )}
      </g>
    </g>
  )
}
