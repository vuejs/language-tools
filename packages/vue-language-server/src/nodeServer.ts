import { createLanguageServer } from '@volar/language-server/node';
import * as plugin from './plugin';

createLanguageServer([plugin]);
