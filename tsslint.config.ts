import { defineConfig } from '@tsslint/config';
import { getDefaultRules as getDefaultVolarRules } from 'https://raw.githubusercontent.com/volarjs/volar.js/master/tsslint.config.ts';

export default defineConfig({
	rules: {
		...getDefaultVolarRules(),
	},
	plugins: [
		({ tsconfig }) => ({
			resolveRules(fileName, rules) {
				if (tsconfig.endsWith('extensions/vscode/tsconfig.json')) {
					delete rules['missing-dependency'];
				}
				return rules;
			},
		}),
	],
});
