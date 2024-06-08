import { defineConfig } from '@tsslint/config';

export default defineConfig({
	...(await import('https://raw.githubusercontent.com/volarjs/volar.js/master/tsslint.config.ts')).default,
	plugins: [
		({ tsconfig }) => ({
			resolveRules(rules) {
				if (tsconfig.endsWith('extensions/vscode/tsconfig.json')) {
					delete rules['missing-dependency'];
				}
				return rules;
			},
		}),
	]
});
