import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['index.ts'],
    format: ['cjs', 'esm'],
    dts: true,
    clean: true,
    tsconfig: './tsconfig.json',
    splitting: false,
    sourcemap: true
});