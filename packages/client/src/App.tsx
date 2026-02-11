import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { LandingPage } from './pages/LandingPage.js'
import { WorldView } from './pages/WorldView.js'
import { Dashboard } from './pages/Dashboard.js'
import { ClaimPage } from './pages/ClaimPage.js'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/world" element={<WorldView />} />
        <Route path="/guide" element={<LandingPage />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/claim/:code" element={<ClaimPage />} />
      </Routes>
    </BrowserRouter>
  )
}
