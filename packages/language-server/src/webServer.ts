import { createConnection, startLanguageServer } from '@volar/language-server/browser';
import { createServerPlugin } from './languageServerPlugin';

const connection = createConnection();
const plugin = createServerPlugin(connection);

startLanguageServer(connection, plugin);
