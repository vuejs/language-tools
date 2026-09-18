import { runMapperServer } from '@vue/content-mapper';
import * as path from 'node:path';
import { vitePressContentMapper } from './project';

runMapperServer(vitePressContentMapper, {
	workerPath: path.resolve(__dirname, 'worker.js'),
});
