/// <reference types="@volar/typescript" />

export * from '@volar/language-service';
// for @vue/language-server usage
export * from '@volar/language-service/lib/utils/featureWorkers';

import type { Requests } from '@vue/typescript-plugin/lib/requests';
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
import { create as createVueExtractFilePlugin } from './lib/plugins/vue-extract-file';
import { create as createVueFormatPerBlockPlugin } from './lib/plugins/vue-format-per-block';
import { create as createVueInlayHintsPlugin } from './lib/plugins/vue-inlayhints';
import { create as createVueMissingPropsHintsPlugin } from './lib/plugins/vue-missing-props-hints';
import { create as createVueScopedClassLinksPlugin } from './lib/plugins/vue-scoped-class-links';
import { create as createVueSfcPlugin } from './lib/plugins/vue-sfc';
import { create as createVueSuggestDefineAssignmentPlugin } from './lib/plugins/vue-suggest-define-assignment';
import { create as createVueTemplatePlugin } from './lib/plugins/vue-template';
import { create as createVueTemplateRefLinksPlugin } from './lib/plugins/vue-template-ref-links';
import { create as createVueTwoslashQueriesPlugin } from './lib/plugins/vue-twoslash-queries';

const noop = () => {};

export function createVueLanguageServicePlugins(
	ts: typeof import('typescript'),
	client = new Proxy({} as Requests, {
		get() {
			return noop;
		},
	}),
) {
	return [
		createJsonPlugin(),
		createPugFormatPlugin(),
		createVueFormatPerBlockPlugin(),
		createVueAutoSpacePlugin(),
		createVueCompilerDomErrorsPlugin(),
		createVueDirectiveCommentsPlugin(),
		createVueScopedClassLinksPlugin(),
		createVueSfcPlugin(),
		createVueTemplateRefLinksPlugin(),
		createEmmetPlugin({
			mappedLanguages: {
				'vue-root-tags': 'html',
				'postcss': 'scss',
			},
		}),

		// TS related plugins
		createVueSuggestDefineAssignmentPlugin(ts),
		createTypeScriptDocCommentTemplatePlugin(ts),
		createTypeScriptSyntacticPlugin(ts),
		createVueInlayHintsPlugin(ts),

		// type aware plugins
		createCssPlugin(client),
		createTypescriptSemanticTokensPlugin(client),
		createVueAutoDotValuePlugin(ts, client),
		createVueComponentSemanticTokensPlugin(client),
		createVueDocumentDropPlugin(ts, client),
		createVueDocumentHighlightsPlugin(client),
		createVueExtractFilePlugin(ts, client),
		createVueMissingPropsHintsPlugin(client),
		createVueTemplatePlugin(ts, 'html', client),
		createVueTemplatePlugin(ts, 'jade', client),
		createVueTwoslashQueriesPlugin(client),
	];
}
