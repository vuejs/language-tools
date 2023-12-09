import { createConnection, startTypeScriptServer } from '@volar/language-server/browser';
import { createServerPlugin } from './languageServerPlugin';

const connection = createConnection();
const plugin = createServerPlugin(connection);

startTypeScriptServer(connection, plugin);
