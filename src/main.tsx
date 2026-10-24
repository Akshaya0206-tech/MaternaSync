import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
// The menu, tour, banners, Emergency button and most page layouts are styled here. Pages are downloaded one by one,
// so this is loaded up front (after index.css, as before) rather than with whichever page happens to import it.
import './components/continuity/continuity.css'
import { AuthProvider } from './auth/AuthContext'
import { AppRoutes } from './routes/AppRoutes'
import { applyTextSize } from './accessibility/textSize'

applyTextSize() // the text size chosen on this device applies from the first screen, signed in or not

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
