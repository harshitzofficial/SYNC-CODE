import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { RecoilRoot } from 'recoil'
import { Toaster } from 'sonner'

createRoot(document.getElementById('root')!).render(
  <RecoilRoot>
    <Toaster />
      <App />
  </RecoilRoot>
)
