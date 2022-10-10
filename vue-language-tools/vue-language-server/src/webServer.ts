import { createLanguageServer } from '@volar/language-server/browser';
import * as plugin from './languageServerPlugin';

createLanguageServer([plugin]);
