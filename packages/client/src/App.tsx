import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { HomePage } from './pages/HomePage.js'
import { WorldView } from './pages/WorldView.js'
import { ClaimPage } from './pages/ClaimPage.js'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/world" element={<WorldView />} />
        <Route path="/claim/:code" element={<ClaimPage />} />
      </Routes>
    </BrowserRouter>
  )
}
