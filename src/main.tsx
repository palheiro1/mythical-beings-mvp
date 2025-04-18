import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom' // Import BrowserRouter
import './index.css' // Ensure index.css is imported (it likely already is, but good to double-check)
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter> {/* Wrap App with BrowserRouter */} 
      <App />
    </BrowserRouter>
  </StrictMode>,
)
