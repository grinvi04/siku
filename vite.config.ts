/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ')),
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    // vitest는 단위 테스트만 — tests/e2e/*.spec.ts는 Playwright 전용 (npm run test:e2e)
    include: ['src/**/*.test.{ts,tsx}'],
  },
  build: {
    // heic2any(외부 라이브러리, lazy 청크) 1.35MB가 알려진 상한 — 그보다 큰 청크가 새로 생기면 경고
    chunkSizeWarningLimit: 1400,
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: '식구 (SIKU)',
        short_name: '식구',
        description: '밥 같이 먹는 사이의 기록·사진·정산',
        lang: 'ko',
        display: 'standalone',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallbackDenylist: [/^\/i\//], // 초대 OG edge function 경로는 SW가 가로채지 않음
        // heic2any(1.35MB, lazy 청크)는 HEIC 업로드 때만 쓰므로 설치 시 미리 받지 않는다
        globIgnores: ['**/heic2any-*.js'],
      },
    }),
  ],
})
