import { defineConfig } from 'tsup';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pkg = require('./package.json') as { dependencies?: Record<string, string> };

// 除 @qujt/shared（TS 源码需打包）外，其余依赖保持外部（部署时随 node_modules 安装）
const external = Object.keys(pkg.dependencies ?? {})
  .filter((d) => d !== '@qujt/shared')
  .concat(['better-sqlite3', 'argon2']);

export default defineConfig({
  entry: ['src/index.ts'],
  // 工作区包必须打进产物（服务器上无 TS 运行时）
  noExternal: ['@qujt/shared'],
  format: ['esm'],
  target: 'node20',
  clean: true,
  sourcemap: true,
  external,
});