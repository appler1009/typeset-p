import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  platform: 'browser',
  dts: true,
  sourcemap: true,
  clean: true,
  noExternal: [/.*/],
  treeshake: true,
  minify: false,
  target: 'es2020',
});
