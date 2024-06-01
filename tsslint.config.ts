import { defineConfig } from '@tsslint/config';
import VolarLintConfig from '@volar/tsslint-config';

export default defineConfig({
	...VolarLintConfig,
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
