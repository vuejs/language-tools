import { createNodeServer } from '@volar/language-server/out/nodeServer';
import * as plugin from './plugin';

createNodeServer([plugin]);
