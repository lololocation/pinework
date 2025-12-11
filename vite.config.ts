import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // 关键配置：确保构建后的资源路径为相对路径
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  }
});