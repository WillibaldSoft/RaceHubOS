import { createContext, useContext } from 'react'
export const FeatureContext = createContext(null)
export function useFeatures() {
  return useContext(FeatureContext)
}
export function useTrackPlanner() {
  const { planner } = useFeatures()
  return { ...planner, available: planner.enabled && planner.compatible }
}
