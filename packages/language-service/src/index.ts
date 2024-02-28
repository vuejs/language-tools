export * from '@volar/language-service';
export * from '@vue/language-core';
export * from './ideFeatures/nameCasing';
export * from './types';

import type { ServiceEnvironment, ServicePlugin } from '@volar/language-service';
import type { VueCompilerOptions } from './types';

import { create as createEmmetServicePlugin } from 'volar-service-emmet';
import { create as createJsonServicePlugin } from 'volar-service-json';
import { create as createPugFormatServicePlugin } from 'volar-service-pug-beautify';
import { create as createTypeScriptTwoslashQueriesServicePlugin } from 'volar-service-typescript-twoslash-queries';
import { create as createCssServicePlugin } from './plugins/css';
import { create as createTypeScriptServicePlugin } from './plugins/typescript';
import { create as createVueAutoDotValueServicePlugin } from './plugins/vue-autoinsert-dotvalue';
import { create as createVueAutoWrapParenthesesServicePlugin } from './plugins/vue-autoinsert-parentheses';
import { create as createVueAutoAddSpaceServicePlugin } from './plugins/vue-autoinsert-space';
import { create as createVueReferencesCodeLensServicePlugin } from './plugins/vue-codelens-references';
import { create as createVueDirectiveCommentsServicePlugin } from './plugins/vue-directive-comments';
import { create as createVueDocumentDropServicePlugin } from './plugins/vue-document-drop';
import { create as createVueExtractFileServicePlugin } from './plugins/vue-extract-file';
import { create as createVueSfcServicePlugin } from './plugins/vue-sfc';
import { create as createVueTemplateServicePlugin } from './plugins/vue-template';
import { create as createVueToggleVBindServicePlugin } from './plugins/vue-toggle-v-bind-codeaction';
import { create as createVueTwoslashQueriesServicePlugin } from './plugins/vue-twoslash-queries';
import { create as createVueVisualizeHiddenCallbackParamServicePlugin } from './plugins/vue-visualize-hidden-callback-param';

export function createVueServicePlugins(
	ts: typeof import('typescript'),
	getVueOptions: (env: ServiceEnvironment) => VueCompilerOptions,
): ServicePlugin[] {
	return [
		createTypeScriptServicePlugin(ts, getVueOptions),
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
