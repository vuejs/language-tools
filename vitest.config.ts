import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		testTimeout: 60_000,
		poolOptions: {
			forks: {
				singleFork: true,
				isolate: false,
			},
		},
		exclude: [
			'extensions/vscode/tests/out/**/*',
			'extensions/vscode/tests/suite/**/*',
		],
	},
});
