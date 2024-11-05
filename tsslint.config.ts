import { defineConfig } from '@tsslint/config';
import config from 'https://raw.githubusercontent.com/johnsoncodehk/tsslint-config/refs/heads/master/v1.1.cjs';

export default defineConfig({
	exclude: [
		'**/*.vue',
		'extensions/vscode/src/generated-meta.ts',
	],
	rules: config.rules,
});
