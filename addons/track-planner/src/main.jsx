import React from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import StandalonePlanner from './StandalonePlanner'
import EmbeddedPlanner from './EmbeddedPlanner'
createRoot(document.getElementById('root')).render(
  window.parent === window ? <StandalonePlanner /> : <EmbeddedPlanner />
)
