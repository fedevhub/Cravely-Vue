import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['img/logo.png'],
      manifest: {
        name: 'Cravely', short_name: 'Cravely', description: 'Freshly made small-batch snacks.',
        theme_color: '#c9843d', background_color: '#fff8f0', display: 'standalone', start_url: '/',
        icons: [{ src: 'img/logo.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }],
      },
    }),
  ],
})
