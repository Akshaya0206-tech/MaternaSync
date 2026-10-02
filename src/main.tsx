import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthGate } from './components/auth/AuthGate'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthGate>
      {(user, logout) => <App currentUser={user} onLogout={logout} />}
    </AuthGate>
  </StrictMode>,
)
