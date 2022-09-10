import useCssPlugin from '@volar-plugins/css';
import useHtmlPlugin from '@volar-plugins/html';
import useJsonPlugin from '@volar-plugins/json';
import usePugPlugin from '@volar-plugins/pug';
import usePugFormatPlugin from '@volar-plugins/pug-beautify';
import useTsPlugin from '@volar-plugins/typescript';
import { DocumentServiceRuntimeContext } from '@volar/language-service';
import useVuePlugin from './plugins/vue';
import useAutoWrapParenthesesPlugin from './plugins/vue-autoinsert-parentheses';

export function getDocumentServicePlugins(
	context: DocumentServiceRuntimeContext
) {

	const vuePlugin = useVuePlugin({
		getVueDocument: doc => context.getSourceFileDocument(doc)?.[0],
		tsLs: undefined,
		isJsxMissing: false,
	});
	const htmlPlugin = useHtmlPlugin();
	const pugPlugin = usePugPlugin();
	const cssPlugin = useCssPlugin();
	const jsonPlugin = useJsonPlugin();
	const tsPlugin = useTsPlugin();
	const autoWrapParenthesesPlugin = useAutoWrapParenthesesPlugin({
		getVueDocument: doc => context.getSourceFileDocument(doc)?.[0],
	});
	const pugFormatPlugin = usePugFormatPlugin();

	return [
		vuePlugin,
		htmlPlugin,
		pugPlugin,
		pugFormatPlugin,
		cssPlugin,
		jsonPlugin,
		tsPlugin,
		autoWrapParenthesesPlugin,
	];
}
