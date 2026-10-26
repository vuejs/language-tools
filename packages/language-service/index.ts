export * from '@volar/language-service';
// for @vue/language-server usage
export * from '@volar/language-service/lib/utils/featureWorkers';
export * from './lib/languagePlugin';
export * from './lib/virtualCode';

import { create as createJsonPlugin } from 'volar-service-json';
import { create as createPugFormatPlugin } from 'volar-service-pug-beautify';
import { create as createTypeScriptDocCommentTemplatePlugin } from 'volar-service-typescript/lib/plugins/docCommentTemplate';
import { create as createTypeScriptSyntacticPlugin } from 'volar-service-typescript/lib/plugins/syntactic';
import { create as createVueAutoDotValuePlugin } from './lib/plugins/autoInsertDotValue';
import { create as createVueAutoSpacePlugin } from './lib/plugins/autoInsertSpace';
import { create as createVueCompilerDomErrorsPlugin } from './lib/plugins/compilerDomErrors';
import { create as createVueComponentDefinitionPlugin } from './lib/plugins/componentDefinition';
import { create as createCssPlugin } from './lib/plugins/css';
import { create as createVueDirectiveCommentsPlugin } from './lib/plugins/directiveComments';
import { create as createVueDocumentDropPlugin } from './lib/plugins/documentDrop';
import { create as createVueEmmetPlugin } from './lib/plugins/emmet';
import { create as createVueExtractFilePlugin } from './lib/plugins/extractFile';
import { create as createVueFormatPerBlockPlugin } from './lib/plugins/formatPerBlock';
import { create as createVueInlayHintsPlugin } from './lib/plugins/inlayHints';
import { create as createVueMissingPropsHintsPlugin } from './lib/plugins/missingPropsHints';
import { create as createVueScopedClassLinksPlugin } from './lib/plugins/scopedClassLinks';
import { create as createVueSfcPlugin } from './lib/plugins/sfc';
import { create as createVueSuggestDefineAssignmentPlugin } from './lib/plugins/suggestDefineAssignment';
import { create as createVueTemplatePlugin } from './lib/plugins/template';
import { create as createVueTemplateExpressionsPlugin } from './lib/plugins/templateExpressions';
import { create as createVueTemplateImportFixPlugin } from './lib/plugins/templateImportFix';
import { create as createVueTemplateRefLinksPlugin } from './lib/plugins/templateRefLinks';
import type { Requests } from './lib/requests';

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
		createVueEmmetPlugin(ts),

		// TS related plugins
		createVueSuggestDefineAssignmentPlugin(ts),
		createTypeScriptDocCommentTemplatePlugin(ts),
		createTypeScriptSyntacticPlugin(ts),
		createVueInlayHintsPlugin(ts),

		// type aware plugins
		createCssPlugin(client),
		createVueAutoDotValuePlugin(ts, client),
		createVueDocumentDropPlugin(ts, client),
		createVueExtractFilePlugin(ts, client),
		createVueMissingPropsHintsPlugin(client),
		createVueComponentDefinitionPlugin(client),
		createVueTemplateImportFixPlugin(client),
		createVueTemplatePlugin('html', client),
		createVueTemplatePlugin('jade', client),
		// after the template plugins, whose completion takes precedence
		createVueTemplateExpressionsPlugin(ts, client),
	];
}
