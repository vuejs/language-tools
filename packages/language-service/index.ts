export * from '@volar/language-service';
export * from '@vue/language-core';
export * from './lib/ideFeatures/nameCasing';
export * from './lib/types';

import type { ServiceEnvironment, ServicePlugin } from '@volar/language-service';
import type { VueCompilerOptions } from './lib/types';

import { create as createEmmetServicePlugin } from 'volar-service-emmet';
import { create as createJsonServicePlugin } from 'volar-service-json';
import { create as createPugFormatServicePlugin } from 'volar-service-pug-beautify';
import { create as createTypeScriptServicePlugin } from 'volar-service-typescript';
import { create as createTypeScriptTwoslashQueriesServicePlugin } from 'volar-service-typescript-twoslash-queries';
import { create as createCssServicePlugin } from './lib/plugins/css';
import { create as createVueAutoDotValueServicePlugin } from './lib/plugins/vue-autoinsert-dotvalue';
import { create as createVueAutoWrapParenthesesServicePlugin } from './lib/plugins/vue-autoinsert-parentheses';
import { create as createVueAutoAddSpaceServicePlugin } from './lib/plugins/vue-autoinsert-space';
import { create as createVueReferencesCodeLensServicePlugin } from './lib/plugins/vue-codelens-references';
import { create as createVueDirectiveCommentsServicePlugin } from './lib/plugins/vue-directive-comments';
import { create as createVueDocumentDropServicePlugin } from './lib/plugins/vue-document-drop';
import { create as createVueExtractFileServicePlugin } from './lib/plugins/vue-extract-file';
import { create as createVueSfcServicePlugin } from './lib/plugins/vue-sfc';
import { create as createVueTemplateServicePlugin } from './lib/plugins/vue-template';
import { create as createVueToggleVBindServicePlugin } from './lib/plugins/vue-toggle-v-bind-codeaction';
import { create as createVueTwoslashQueriesServicePlugin } from './lib/plugins/vue-twoslash-queries';
import { create as createVueVisualizeHiddenCallbackParamServicePlugin } from './lib/plugins/vue-visualize-hidden-callback-param';

export function createVueServicePlugins(
	ts: typeof import('typescript'),
	getVueOptions: (env: ServiceEnvironment) => VueCompilerOptions,
): ServicePlugin[] {
	return [
		createTypeScriptServicePlugin(ts),
		createTypeScriptTwoslashQueriesServicePlugin(),
		createCssServicePlugin(),
		createPugFormatServicePlugin(),
		createJsonServicePlugin(),
		createVueTemplateServicePlugin('html', ts, getVueOptions),
		createVueTemplateServicePlugin('pug', ts, getVueOptions),
		createVueSfcServicePlugin(),
		createVueTwoslashQueriesServicePlugin(ts),
		createVueReferencesCodeLensServicePlugin(),
		createVueDocumentDropServicePlugin(ts),
		createVueAutoDotValueServicePlugin(ts),
		createVueAutoWrapParenthesesServicePlugin(ts),
		createVueAutoAddSpaceServicePlugin(),
		createVueVisualizeHiddenCallbackParamServicePlugin(),
		createVueDirectiveCommentsServicePlugin(),
		createVueExtractFileServicePlugin(ts),
		createVueToggleVBindServicePlugin(ts),
		createEmmetServicePlugin(),
	];
}
