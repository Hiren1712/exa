import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  if (process.env.CF_PAGES === '1') {
    const apiUrl = env.VITE_API_URL?.trim();
    if (!apiUrl) {
      throw new Error('Cloudflare Pages build requires VITE_API_URL pointing to the deployed backend API.');
    }
    if (!apiUrl.startsWith('https://')) {
      throw new Error('VITE_API_URL must use HTTPS for Cloudflare Pages deployments.');
    }
  }
  const apiProxy = {
    '/api': {
      target: env.VITE_API_PROXY_TARGET || 'http://localhost:8080',
      changeOrigin: true,
      secure: false,
      configure: (proxy) => {
        proxy.on('proxyReq', (proxyRequest) => {
          proxyRequest.removeHeader('origin');
        });
      },
    },
  };

  return {
    plugins: [tailwindcss(), react()],

    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },

    server: {
      host: '0.0.0.0',
      port: 3000,
      open: true,
      proxy: apiProxy,
    },

    preview: {
      host: '0.0.0.0',
      port: 3000,
      proxy: apiProxy,
    },

    build: {
      outDir: 'dist',
      sourcemap: false,
      minify: 'esbuild',
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom'],
            charts: ['recharts'],
            ui: ['lucide-react'],
          },
        },
      },
    },

    esbuild: {
      drop: mode === 'production' ? ['console', 'debugger'] : [],
    },
  };
});