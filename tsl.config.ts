import VolarLintConfig from '@volar/tsl-config';
import { defineConfig } from 'tsl';

export default defineConfig({
	...VolarLintConfig,
	plugins: [
		ctx => ({
			resolveRules(rules) {
				if (ctx.tsconfig.endsWith('extensions/vscode/tsconfig.json')) {
					delete rules['missing-dependency'];
				}
				return rules;
			},
		}),
	]
});
