import React from 'react'
import ReactDOM from 'react-dom/client'
import Figures from './pages/Figures'
import { ensurePublicSession } from './publicSession'
import { redirectLegacyVisitor } from './legacyRedirect'
import './index.css'

ensurePublicSession().finally(() => {
  if (redirectLegacyVisitor('figure')) return
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <Figures />
    </React.StrictMode>,
  )
})
