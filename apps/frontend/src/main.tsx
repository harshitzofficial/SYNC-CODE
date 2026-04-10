import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { RecoilRoot } from 'recoil'
import { Toaster } from 'sonner' //This comes from sonner, a popular library for displaying "toast" notifications (those little pop-up messages that usually appear in the corner of the screen).


//The ! symbol: This is a TypeScript "non-null assertion." It tells TypeScript, "I promise this 'root' element exists in the HTML, so don't worry about it being null."
createRoot(document.getElementById('root')!).render(
  <RecoilRoot>
    <Toaster />
      <App />
  </RecoilRoot>
)

