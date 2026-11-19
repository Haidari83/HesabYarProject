import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'


// سیاست امنیت محتوای برنامه
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');


// پلاگین تزریق CSP فقط در نسخه نهایی
const cspPlugin = () => ({

  name: 'inject-csp',

  // اجرا فقط هنگام Build
  apply: 'build',

  // افزودن تگ امنیتی به HTML خروجی
  transformIndexHtml: {

    order: 'post',

    handler() {

      return [

        {
          tag: 'meta',

          attrs: {
            'http-equiv': 'Content-Security-Policy',
            content: CONTENT_SECURITY_POLICY,
          },

          injectTo: 'head-prepend',
        },

      ];

    },

  },

});


export default defineConfig({

  // مسیر نسبی برای اجرای نسخه file://
  base: './',

  plugins: [
    react(),
    cspPlugin(),
  ],

  // هماهنگی پورت Vite با Electron
  server: {
    port: 5173,
    strictPort: true,
  },

});