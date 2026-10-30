import RaceSounds from './components/race/RaceSounds'
import { FeatureProvider } from './addons/FeatureContext'
import RaceStartSound from './components/race/RaceStartSound'
import { lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import ErrorBoundary from './components/ErrorBoundary'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { DeviceProvider } from './context/DeviceContext'
import { SessionProvider } from './context/SessionContext'
import { AppProvider } from './context/AppContext'
import { VoiceProvider } from './context/VoiceContext'
import { TooltipProvider } from './components/ui/tooltip'
import Layout from './components/Layout'
import RaceScreenHost from './components/race/RaceScreen'
import { RaceAlertsProvider } from './context/RaceAlertsContext'

// Lazy load all pages
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Drivers = lazy(() => import('./pages/Drivers'))
const DriverProfile = lazy(() => import('./pages/DriverProfile'))
const Cars = lazy(() => import('./pages/Cars'))
const CarProfile = lazy(() => import('./pages/CarProfile'))
const Tracks = lazy(() => import('./pages/Tracks'))
const TrackProfile = lazy(() => import('./pages/TrackProfile'))
const Teams = lazy(() => import('./pages/Teams'))
const Displays = lazy(() => import('./pages/Displays'))
const DriverDisplayDemo = lazy(() => import('./pages/DriverDisplayDemo'))
const SessionsList = lazy(() => import('./pages/SessionsList'))
const SessionDetail = lazy(() => import('./pages/SessionDetail'))
const Stats = lazy(() => import('./pages/Stats'))
const Settings = lazy(() => import('./pages/Settings'))
const RaceScreenSettings = lazy(() => import('./components/race/RaceScreenSettings'))
const Test = lazy(() => import('./pages/Test'))
const FreeSessionPage = lazy(() => import('./pages/FreeSessionPage'))
const BalancingPage = lazy(() => import('./pages/BalancingPage'))
const Championships = lazy(() => import('./pages/Championships'))
const ChampionshipDetail = lazy(() => import('./pages/ChampionshipDetail'))

function App() {
  const { t } = useTranslation('common')
  const loading = (
    <div role="status" className="p-8 text-center text-lg">
      {t('loadingView')}
    </div>
  )
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AppProvider>
          <FeatureProvider>
            <DeviceProvider>
              <VoiceProvider>
                <SessionProvider>
                  <RaceAlertsProvider>
                    <RaceStartSound />
                    <RaceSounds />
                    <RaceScreenHost />
                    <TooltipProvider>
                      <Routes>
                        {/* Main layout with sidebar */}
                        <Route path="/" element={<Layout />}>
                          <Route
                            index
                            element={
                              <Suspense fallback={loading}>
                                <Dashboard />
                              </Suspense>
                            }
                          />
                          {/* Free session mode */}
                          <Route
                            path="race"
                            element={
                              <Suspense fallback={loading}>
                                <FreeSessionPage />
                              </Suspense>
                            }
                          />
                          <Route
                            path="balancing"
                            element={
                              <Suspense fallback={loading}>
                                <BalancingPage />
                              </Suspense>
                            }
                          />
                          {/* Championships */}
                          <Route
                            path="championships"
                            element={
                              <Suspense fallback={loading}>
                                <Championships />
                              </Suspense>
                            }
                          />
                          <Route
                            path="championships/:id"
                            element={
                              <Suspense fallback={loading}>
                                <ChampionshipDetail />
                              </Suspense>
                            }
                          />
                          {/* Core routes */}
                          <Route
                            path="drivers"
                            element={
                              <Suspense fallback={loading}>
                                <Drivers />
                              </Suspense>
                            }
                          />
                          <Route
                            path="drivers/:id"
                            element={
                              <Suspense fallback={loading}>
                                <DriverProfile />
                              </Suspense>
                            }
                          />
                          <Route
                            path="cars"
                            element={
                              <Suspense fallback={loading}>
                                <Cars />
                              </Suspense>
                            }
                          />
                          <Route
                            path="cars/:id"
                            element={
                              <Suspense fallback={loading}>
                                <CarProfile />
                              </Suspense>
                            }
                          />
                          <Route
                            path="tracks"
                            element={
                              <Suspense fallback={loading}>
                                <Tracks />
                              </Suspense>
                            }
                          />
                          <Route
                            path="tracks/:id"
                            element={
                              <Suspense fallback={loading}>
                                <TrackProfile />
                              </Suspense>
                            }
                          />
                          <Route
                            path="teams"
                            element={
                              <Suspense fallback={loading}>
                                <Teams />
                              </Suspense>
                            }
                          />
                          {/* Session history */}
                          <Route
                            path="sessions"
                            element={
                              <Suspense fallback={loading}>
                                <SessionsList />
                              </Suspense>
                            }
                          />
                          <Route
                            path="sessions/:id"
                            element={
                              <Suspense fallback={loading}>
                                <SessionDetail />
                              </Suspense>
                            }
                          />
                          <Route
                            path="history"
                            element={
                              <Suspense fallback={loading}>
                                <SessionsList />
                              </Suspense>
                            }
                          />
                          {/* Utils */}
                          <Route
                            path="stats"
                            element={
                              <Suspense fallback={loading}>
                                <Stats />
                              </Suspense>
                            }
                          />
                          <Route
                            path="settings"
                            element={
                              <Suspense fallback={loading}>
                                <Settings />
                              </Suspense>
                            }
                          />
                          <Route
                            path="settings/race-screen"
                            element={
                              <Suspense fallback={loading}>
                                <RaceScreenSettings />
                              </Suspense>
                            }
                          />
                          <Route
                            path="displays"
                            element={
                              <Suspense fallback={loading}>
                                <Displays />
                              </Suspense>
                            }
                          />
                          <Route
                            path="demo-displays"
                            element={
                              <Suspense fallback={loading}>
                                <DriverDisplayDemo />
                              </Suspense>
                            }
                          />
                          <Route
                            path="test"
                            element={
                              <Suspense fallback={loading}>
                                <Test />
                              </Suspense>
                            }
                          />
                        </Route>

                        {/* Routes without sidebar */}
                        <Route path="*" element={<Navigate to="/" replace />} />
                      </Routes>
                    </TooltipProvider>
                  </RaceAlertsProvider>
                </SessionProvider>
              </VoiceProvider>
            </DeviceProvider>
          </FeatureProvider>
        </AppProvider>
      </BrowserRouter>
    </ErrorBoundary>
  )
}

export default App
