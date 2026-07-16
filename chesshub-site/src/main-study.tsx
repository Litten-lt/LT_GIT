import React from 'react'
import ReactDOM from 'react-dom/client'
import StudyPage from './pages/Study'
import { ensurePublicSession } from './publicSession'
import { redirectLegacyVisitor } from './legacyRedirect'
import './index.css'

ensurePublicSession().finally(() => {
  if (redirectLegacyVisitor('study')) return
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <StudyPage />
    </React.StrictMode>,
  )
})
