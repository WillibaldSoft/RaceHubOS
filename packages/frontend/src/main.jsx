import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n'
import App from './App.jsx'
import { recoverView } from './lib/recoverView.mjs'

window.addEventListener('vite:preloadError', (event) => {
  if (recoverView(event.payload)) event.preventDefault()
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)
