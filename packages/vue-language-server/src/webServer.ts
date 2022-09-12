import { createWebServer } from '@volar/language-server/browser';
import * as plugin from './plugin';

createWebServer([plugin]);
