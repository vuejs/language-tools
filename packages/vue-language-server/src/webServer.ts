import { createWebServer } from '@volar/language-server/out/webServer';
import * as plugin from './plugin';

createWebServer([plugin]);
