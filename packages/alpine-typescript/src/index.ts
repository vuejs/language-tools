import * as vueTs from '@volar/vue-typescript';
import useHtmlFilePlugin from './plugins/file-html';

export type LanguageServiceHost = ts.LanguageServiceHost;

export function createLanguageServiceContext(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	host: ts.LanguageServiceHost,
): ReturnType<typeof vueTs.createLanguageServiceContext> {
	return vueTs.createLanguageServiceContext(
		ts,
		{
			...host,
			getVueCompilationSettings: () => ({}),
		},
		[useHtmlFilePlugin()],
		['.html']
	);
}
