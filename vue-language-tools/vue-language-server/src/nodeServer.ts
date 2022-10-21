import { createLanguageServer } from '@volar/language-server/node';
import * as plugin from './languageServerPlugin';

createLanguageServer([plugin]);
