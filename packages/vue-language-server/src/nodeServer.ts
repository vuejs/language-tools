import { createNodeServer } from '@volar/embedded-language-server/out/nodeServer';
import { languageConfigs } from './languageConfigs';

createNodeServer([languageConfigs]);
