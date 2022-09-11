import { createNodeServer } from '@volar/language-server/node';
import * as plugin from './plugin';

createNodeServer([plugin]);
