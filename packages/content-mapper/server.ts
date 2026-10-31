import { vueContentMapper } from './lib/mapper/vueContentMapper';
import { runMapperServer } from './lib/server/stdioServer';

runMapperServer(vueContentMapper);
