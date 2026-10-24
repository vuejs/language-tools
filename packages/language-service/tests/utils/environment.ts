import type { LanguageServiceEnvironment } from '@volar/language-service';
import { URI } from 'vscode-uri';

export function createTestEnvironment(getSettings: () => Record<string, any>): LanguageServiceEnvironment {
	return {
		workspaceFolders: [URI.file(process.cwd())],
		getConfiguration(section: string) {
			const settings = getSettings();
			if (section in settings) {
				return settings[section];
			}
			let result: any;
			for (const settingKey in settings) {
				if (settingKey.startsWith(`${section}.`)) {
					const props = settingKey.substring(section.length + 1).split('.');
					result ??= {};
					let current = result;
					while (props.length > 1) {
						const prop = props.shift()!;
						if (typeof current[prop] !== 'object') {
							current[prop] = {};
						}
						current = current[prop];
					}
					current[props.shift()!] = settings[settingKey];
				}
			}
			return result;
		},
	};
}
