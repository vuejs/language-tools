import * as path from 'node:path';
import { vueContentMapper } from './project';
import { runMapperServer } from './runtime';

runMapperServer(vueContentMapper, {
	workerPath: path.resolve(__dirname, 'worker.js'),
});
