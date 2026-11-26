import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'
import App from './App'
import './styles/globals.css'

const Preview =
  import.meta.env.DEV && window.location.pathname === '/design-system'
    ? React.lazy(() => import('./DesignSystemPreview'))
    : import.meta.env.DEV && window.location.pathname === '/robot-preview'
      ? React.lazy(() => import('./features/robot-preview/RobotPreview'))
      : null

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {Preview ? (
      <React.Suspense fallback={null}>
        <Preview />
      </React.Suspense>
    ) : (
      <App />
    )}
  </React.StrictMode>,
)
