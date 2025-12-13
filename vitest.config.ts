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
		include: [
			'packages/**/*.spec.?(c|m)[jt]s?(x)',
			'extensions/vscode/**/*.spec.?(c|m)[jt]s?(x)',
		],
	},
});
