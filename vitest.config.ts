import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		include: ['packages/language-server/tests/**/*.spec.ts'],
		poolOptions: {
			forks: {
				singleFork: true,
				isolate: false,
			},
		},
	},
});
