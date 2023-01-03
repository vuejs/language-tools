import createPugPlugin from '@volar-plugins/pug';
import createPugBeautifyPlugin from '@volar-plugins/pug-beautify';
import { createConnection, startLanguageServer, LanguageServerPlugin } from '@volar/language-server/node';

const plugin: LanguageServerPlugin = () => ({
	extraFileExtensions: [{ extension: 'pug', isMixedContent: true }],
	getLanguageServicePlugins() {
		return [
			createPugPlugin(),
			createPugBeautifyPlugin(),
		];
	},
});

startLanguageServer(createConnection(), plugin);
