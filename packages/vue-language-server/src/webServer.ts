import { createWebServer } from '@volar/embedded-language-server/out/webServer';
import { languageConfigs } from './languageConfigs';

createWebServer([languageConfigs]);
