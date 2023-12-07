import { TypeScriptServerPlugin, createConnection, startTypeScriptServer } from '@volar/language-server/node';
import { createServerPlugin } from './languageServerPlugin';

const connection = createConnection();
const plugin = createServerPlugin(connection);

startTypeScriptServer(connection, plugin as TypeScriptServerPlugin);
