/// <reference types="@volar/typescript" />

export * from '@volar/language-service';
// for @vue/language-server usage
export * from '@volar/language-service/lib/utils/featureWorkers';

import type { LanguageServiceContext, LanguageServicePlugin } from '@volar/language-service';
import type { VueCompilerOptions } from '@vue/language-core';
import type * as ts from 'typescript';

import { create as createEmmetPlugin } from 'volar-service-emmet';
import { create as createJsonPlugin } from 'volar-service-json';
import { create as createPugFormatPlugin } from 'volar-service-pug-beautify';
import { create as createTypeScriptTwoslashQueriesPlugin } from 'volar-service-typescript-twoslash-queries';
import { create as createTypeScriptDocCommentTemplatePlugin } from 'volar-service-typescript/lib/plugins/docCommentTemplate';
import { create as createTypeScriptSyntacticPlugin } from 'volar-service-typescript/lib/plugins/syntactic';
import { create as createCssPlugin } from './lib/plugins/css';
import { create as createVueAutoDotValuePlugin } from './lib/plugins/vue-autoinsert-dotvalue';
import { create as createVueAutoAddSpacePlugin } from './lib/plugins/vue-autoinsert-space';
import { create as createVueCompilerDomErrorsPlugin } from './lib/plugins/vue-compiler-dom-errors';
import { create as createVueCompleteDefineAssignmentPlugin } from './lib/plugins/vue-complete-define-assignment';
import { create as createVueDirectiveCommentsPlugin } from './lib/plugins/vue-directive-comments';
import { create as createVueDocumentDropPlugin } from './lib/plugins/vue-document-drop';
import { create as createVueDocumentHighlightsPlugin } from './lib/plugins/vue-document-highlights';
import { create as createVueDocumentLinksPlugin } from './lib/plugins/vue-document-links';
import { create as createVueExtractFilePlugin } from './lib/plugins/vue-extract-file';
import { create as createVueInlayHintsPlugin } from './lib/plugins/vue-inlayhints';
import { create as createVueMissingPropsHintsPlugin } from './lib/plugins/vue-missing-props-hints';
import { create as createVueSfcPlugin } from './lib/plugins/vue-sfc';
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
	tsPluginClient: import('@vue/typescript-plugin/lib/requests').Requests & {
		getDocumentHighlights: (fileName: string, position: number) => Promise<ts.DocumentHighlights[] | null>;
	} | undefined
) {
	const plugins = [
		createTypeScriptSyntacticPlugin(ts),
		createTypeScriptDocCommentTemplatePlugin(ts),
		...getCommonLanguageServicePlugins(ts, () => tsPluginClient)
	];
	if (tsPluginClient) {
		plugins.push(createVueDocumentHighlightsPlugin(tsPluginClient.getDocumentHighlights));
	}
	for (const plugin of plugins) {
		// avoid affecting TS plugin
		delete plugin.capabilities.semanticTokensProvider;
	}
	return plugins;
}

function getCommonLanguageServicePlugins(
	ts: typeof import('typescript'),
	getTsPluginClient: (context: LanguageServiceContext) => import('@vue/typescript-plugin/lib/requests').Requests | undefined
): LanguageServicePlugin[] {
	return [
		createTypeScriptTwoslashQueriesPlugin(ts),
		createCssPlugin(),
		createPugFormatPlugin(),
		createJsonPlugin(),
		createVueTemplatePlugin('html', getTsPluginClient),
		createVueTemplatePlugin('pug', getTsPluginClient),
		createVueMissingPropsHintsPlugin(getTsPluginClient),
		createVueCompilerDomErrorsPlugin(),
		createVueSfcPlugin(),
		createVueTwoslashQueriesPlugin(getTsPluginClient),
		createVueDocumentDropPlugin(ts, getTsPluginClient),
		createVueDocumentLinksPlugin(),
		createVueCompleteDefineAssignmentPlugin(),
		createVueAutoDotValuePlugin(ts, getTsPluginClient),
		createVueAutoAddSpacePlugin(),
		createVueInlayHintsPlugin(ts),
		createVueDirectiveCommentsPlugin(),
		createVueExtractFilePlugin(ts, getTsPluginClient),
		createEmmetPlugin({
			mappedLanguages: {
				'vue-root-tags': 'html',
				'postcss': 'scss',
			},
		}),
	];
}
