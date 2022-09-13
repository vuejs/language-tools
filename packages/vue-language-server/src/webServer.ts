import { createLanguageServer } from '@volar/language-server/browser';
import * as plugin from './plugin';

createLanguageServer([plugin]);
