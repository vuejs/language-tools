import { LanguageServicePlugin } from '@volar/language-service';

export function loadCustomPlugins(dir: string) {
	try {
		const configPath = require.resolve('./volar.config.js', { paths: [dir] });
		const config: { plugins?: LanguageServicePlugin[]; } = require(configPath);
		// console.warn('Found', configPath, 'and loaded', config.plugins?.length, 'plugins.');
		return config.plugins ?? [];
	}
	catch (err) {
		// console.warn('No volar.config.js found in', dir);
		return [];
	}
}
