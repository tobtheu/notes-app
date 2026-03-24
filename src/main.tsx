import { createRoot } from 'react-dom/client'
import './index.css'
import './lib/ipc'
import App from './App.tsx'
import { attachConsole } from '@tauri-apps/plugin-log'

// Forward browser console to Tauri logs
if (window.__TAURI_INTERNALS__) {
  attachConsole().catch(console.warn);
}

createRoot(document.getElementById('root')!).render(
  <App />
)
