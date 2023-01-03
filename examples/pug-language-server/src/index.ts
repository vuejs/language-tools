import createPugPlugin from '@volar-plugins/pug';
import createPugBeautifyPlugin from '@volar-plugins/pug-beautify';
import { createLanguageServer, LanguageServerPlugin } from '@volar/language-server/node';

const plugin: LanguageServerPlugin = () => ({
	extraFileExtensions: [{ extension: 'pug', isMixedContent: true }],
	getServicePlugins() {
		return [
			createPugPlugin(),
			createPugBeautifyPlugin(),
		];
	},
});

createLanguageServer([plugin]);
