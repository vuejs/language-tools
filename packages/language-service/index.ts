/// <reference types="@volar/typescript" />

export * from '@volar/language-service';
// for @vue/language-server usage
export * from '@volar/language-service/lib/utils/featureWorkers';

import type { VueCompilerOptions } from '@vue/language-core';
import type * as ts from 'typescript';

import { create as createEmmetPlugin } from 'volar-service-emmet';
import { create as createJsonPlugin } from 'volar-service-json';
import { create as createPugFormatPlugin } from 'volar-service-pug-beautify';
import { create as createTypeScriptDocCommentTemplatePlugin } from 'volar-service-typescript/lib/plugins/docCommentTemplate';
import { create as createTypeScriptSyntacticPlugin } from 'volar-service-typescript/lib/plugins/syntactic';
import { create as createCssPlugin } from './lib/plugins/css';
import { create as createTypescriptSemanticTokensPlugin } from './lib/plugins/typescript-semantic-tokens';
import { create as createVueAutoDotValuePlugin } from './lib/plugins/vue-autoinsert-dotvalue';
import { create as createVueAutoSpacePlugin } from './lib/plugins/vue-autoinsert-space';
import { create as createVueCompilerDomErrorsPlugin } from './lib/plugins/vue-compiler-dom-errors';
import { create as createVueComponentSemanticTokensPlugin } from './lib/plugins/vue-component-semantic-tokens';
import { create as createVueDirectiveCommentsPlugin } from './lib/plugins/vue-directive-comments';
import { create as createVueDocumentDropPlugin } from './lib/plugins/vue-document-drop';
import { create as createVueDocumentHighlightsPlugin } from './lib/plugins/vue-document-highlights';
import { create as createVueDocumentLinksPlugin } from './lib/plugins/vue-document-links';
import { create as createVueExtractFilePlugin } from './lib/plugins/vue-extract-file';
import { create as createVueGlobalTypesErrorPlugin } from './lib/plugins/vue-global-types-error';
import { create as createVueInlayHintsPlugin } from './lib/plugins/vue-inlayhints';
import { create as createVueMissingPropsHintsPlugin } from './lib/plugins/vue-missing-props-hints';
import { create as createVueSfcPlugin } from './lib/plugins/vue-sfc';
import { create as createVueSuggestDefineAssignmentPlugin } from './lib/plugins/vue-suggest-define-assignment';
import { create as createVueTemplatePlugin } from './lib/plugins/vue-template';
import { create as createVueTwoslashQueriesPlugin } from './lib/plugins/vue-twoslash-queries';

declare module '@volar/language-service' {
	export interface ProjectContext {
		vue?: {
			compilerOptions: VueCompilerOptions;
		};
	}
}

export function createVueLanguageServicePlugins(
	ts: typeof import('typescript'),
	tsPluginClient:
		| import('@vue/typescript-plugin/lib/requests').Requests & {
			getDocumentHighlights: (fileName: string, position: number) => Promise<ts.DocumentHighlights[] | null>;
		}
		| undefined,
) {
	const getTsPluginClient = () => tsPluginClient;
	const plugins = [
		createCssPlugin(),
		createJsonPlugin(),
		createPugFormatPlugin(),
		createTypeScriptDocCommentTemplatePlugin(ts),
		createTypescriptSemanticTokensPlugin(getTsPluginClient),
		createTypeScriptSyntacticPlugin(ts),
		createVueAutoSpacePlugin(),
		createVueAutoDotValuePlugin(ts, getTsPluginClient),
		createVueCompilerDomErrorsPlugin(),
		createVueComponentSemanticTokensPlugin(getTsPluginClient),
		createVueDocumentDropPlugin(ts, getTsPluginClient),
		createVueDocumentLinksPlugin(),
		createVueDirectiveCommentsPlugin(),
		createVueExtractFilePlugin(ts, getTsPluginClient),
		createVueGlobalTypesErrorPlugin(),
		createVueInlayHintsPlugin(ts),
		createVueMissingPropsHintsPlugin(getTsPluginClient),
		createVueSfcPlugin(),
		createVueSuggestDefineAssignmentPlugin(),
		createVueTemplatePlugin('html', getTsPluginClient),
		createVueTemplatePlugin('pug', getTsPluginClient),
		createVueTwoslashQueriesPlugin(getTsPluginClient),
		createEmmetPlugin({
			mappedLanguages: {
				'vue-root-tags': 'html',
				'postcss': 'scss',
			},
		}),
	];
	if (tsPluginClient) {
		plugins.push(createVueDocumentHighlightsPlugin(tsPluginClient.getDocumentHighlights));
	}
	return plugins;
}
