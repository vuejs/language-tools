import { createConnection, startSimpleServer } from '@volar/language-server/node';
import { createServerPlugin } from './languageServerPlugin';

const connection = createConnection();
const plugin = createServerPlugin(connection);

startSimpleServer(connection, plugin);
