import { createConnection, startLanguageServer } from '@volar/language-server/node';
import { createServerPlugin } from './languageServerPlugin';

const connection = createConnection();
const plugin = createServerPlugin(connection);

startLanguageServer(connection, plugin);
