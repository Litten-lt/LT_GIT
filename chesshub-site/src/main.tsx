import React from 'react'
import ReactDOM from 'react-dom/client'
import Home from './pages/Home'
import { HeroBgProvider } from './heroBgContext'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HeroBgProvider>
      <Home />
    </HeroBgProvider>
  </React.StrictMode>,
)