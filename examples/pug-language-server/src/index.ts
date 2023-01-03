import createPugPlugin from '@volar-plugins/pug';
import { createLanguageServer, LanguageServerPlugin } from '@volar/language-server/node';

const plugin: LanguageServerPlugin = () => ({
	getServicePlugins() {
		return [
			createPugPlugin(),
		];
	},
});

createLanguageServer([plugin]);
