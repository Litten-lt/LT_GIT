import React from 'react'
import ReactDOM from 'react-dom/client'
import JournalHub from './pages/JournalHub'
import { ensurePublicSession } from './publicSession'
import './index.css'

ensurePublicSession().finally(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode><JournalHub /></React.StrictMode>,
  )
})
