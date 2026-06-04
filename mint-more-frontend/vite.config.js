// vite.config.js — should look like this
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // no "base" property, or base: '/'
})