import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		testTimeout: 60_000,
		fileParallelism: false,
		isolate: false,
		exclude: [...configDefaults.exclude, 'volar.js/**', 'services/**'],
	},
});
