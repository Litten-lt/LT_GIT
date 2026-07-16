import React from 'react'
import ReactDOM from 'react-dom/client'
import Travel from './pages/Travel'
import { ensurePublicSession } from './publicSession'
import { redirectLegacyVisitor } from './legacyRedirect'
import './index.css'

ensurePublicSession().finally(() => {
  if (redirectLegacyVisitor('travel')) return
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <Travel />
    </React.StrictMode>,
  )
})
