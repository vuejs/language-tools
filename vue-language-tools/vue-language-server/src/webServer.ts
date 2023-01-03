import { createConnection, startLanguageServer } from '@volar/language-server/browser';
import * as plugin from './languageServerPlugin';

startLanguageServer(createConnection(), plugin);
