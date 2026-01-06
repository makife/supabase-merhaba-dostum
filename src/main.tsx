import React from 'react'
// 🔥 COLD START TIME - TÜM MODÜLLERDEN ÖNCE IMPORT ET!
// Bu sayede uygulama kill/restart sonrasında bile doğru timestamp olur
import '@/utils/coldStartTime';

import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { Capacitor } from '@capacitor/core'

// Add a class on native (iOS/Android) to control platform-specific styles
if (Capacitor.getPlatform() !== 'web') {
  document.documentElement.classList.add('is-native')
}

createRoot(document.getElementById("root")!).render(<App />);
