import { createConnection, createServer, loadTsdkByPath } from '@volar/language-server/node';
import { initialize, initializeHybridMode } from './lib/initialize';
import type { VueInitializationOptions } from './lib/types';

const connection = createConnection();
const server = createServer(connection);

connection.listen();

connection.onInitialize(params => {
	const options: VueInitializationOptions = params.initializationOptions;
	const tsdk = loadTsdkByPath(options.typescript.tsdk, params.locale);
	if (options.vue?.hybridMode) {
		return initializeHybridMode(server, params, tsdk.typescript);
	}
	else {
		return initialize(server, params, tsdk.typescript, tsdk.diagnosticMessages);
	}
});

connection.onInitialized(server.initialized);

connection.onShutdown(server.shutdown);
