import * as path from 'node:path';
import { vueContentMapper } from './lib/mapper/vueContentMapper';
import { runMapperServer } from './lib/server/stdioServer';

runMapperServer(vueContentMapper, {
	workerPath: path.resolve(__dirname, 'worker.js'),
});
