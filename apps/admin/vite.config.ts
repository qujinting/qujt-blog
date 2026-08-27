import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// 本地 dev 切换 API 目标：`pnpm dev`=本地沙箱(127.0.0.1:3000)，`pnpm dev:test`=线上测试 API(/test/api)
// 测试 API 的登录 Cookie 限定在 /test 路径，所以测试模式下前端走 /test/api，代理到测试域名
const TEST_HOST = process.env.VITE_TEST_HOST || '115.29.149.137';

export default defineConfig(({ mode }) => {
  const isTest = mode === 'test';
  const proxy: Record<string, { target: string; changeOrigin: boolean }> = isTest
    ? { '/test/api': { target: 'http://' + TEST_HOST, changeOrigin: true } }
    : { '/api': { target: 'http://127.0.0.1:3000', changeOrigin: true } };
  return {
    base: '/admin/',
    plugins: [vue()],
    server: {
      port: 5175,
      proxy,
    },
    build: { outDir: 'dist', chunkSizeWarningLimit: 2500 },
  };
});
