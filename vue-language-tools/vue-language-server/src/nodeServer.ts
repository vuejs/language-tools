import { createConnection, startLanguageServer } from '@volar/language-server/node';
import * as plugin from './languageServerPlugin';

startLanguageServer(createConnection(), plugin);
