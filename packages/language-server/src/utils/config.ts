import { LanguageServicePlugin } from '@volar/language-service';

export function loadCustomPlugins(dir: string) {
	let configPath: string | undefined;
	try {
		configPath = require.resolve('./volar.config.js', { paths: [dir] });
	} catch { }

	try {
		if (configPath) {
			const config: { plugins?: LanguageServicePlugin[]; } = require(configPath);
			delete require.cache[configPath];
			return config.plugins ?? [];
		}
	}
	catch (err) {
		console.log(err);
	}

	return [];
}
