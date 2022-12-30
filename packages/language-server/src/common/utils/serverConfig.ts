import { LanguageServicePlugin } from '@volar/language-service';

export interface ServerConfig {
	plugins?: LanguageServicePlugin[];
}

export function loadServerConfig(dir: string, configFile: string | undefined): ServerConfig | undefined {
	let configPath: string | undefined;
	try {
		configPath = require.resolve(configFile ?? './volar.config.js', { paths: [dir] });
	} catch { }

	try {
		if (configPath) {
			const config: ServerConfig = require(configPath);
			delete require.cache[configPath];
			return config;
		}
	}
	catch (err) {
		console.log(err);
	}
}
