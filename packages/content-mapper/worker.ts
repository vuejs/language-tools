import { vueContentMapper } from './lib/mapper/vueContentMapper';
import { runMapperWorker } from './lib/server/workerThread';

runMapperWorker(vueContentMapper);
