import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { ThemeProvider } from './components/ui/ThemeProvider'

// Restore streamer mode on load
if (localStorage.getItem('gratonite:streamer-mode') === 'true') {
    document.body.classList.add('streamer-mode');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
    <ThemeProvider>
        <App />
    </ThemeProvider>,
)
