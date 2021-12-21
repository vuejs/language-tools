import { generate as generateScript } from './generators/script';
import { generate as generateTemplateScript } from './generators/template_scriptSetup';
import { parseScriptRanges } from './parsers/scriptRanges';
import { parseScriptSetupRanges } from './parsers/scriptSetupRanges';
import * as CompilerDOM from '@vue/compiler-dom';
import * as CompilerVue2 from './vue2TemplateCompiler';

/**
 * @param templateAst Use `require('@vue/compiler-dom').compile` or `require('@volar/vue-code-gen').compileTemplate`, provide to resolve variables unused in script setup
 * @param cssVars Use `require('@vue/compiler-sfc').parseCssVars`, provide to resolve variables unused in script setup
 * @param vueLibName Where should `defineComponent` and `PropType` import from? (For example: `vue`, `@vue/runtime-dom`, `@vue/composition-api`)
 */
export function generateSFCScriptTypeCheckCode(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	scriptLang: 'js' | 'jsx' | 'ts' | 'tsx',
	scriptCode: string | undefined,
	scriptSetupCode: string | undefined,
	exposeScriptSetupContext: boolean,
	templateAst?: CompilerDOM.RootNode,
	cssVars?: string[],
	vueLibName = 'vue',
) {

	const generated = generateScript(
		'script',
		'',
		scriptCode !== undefined ? { content: scriptCode } : undefined,
		scriptSetupCode !== undefined ? { content: scriptSetupCode, exposeContext: exposeScriptSetupContext } : undefined,
		scriptCode !== undefined ? parseScriptRanges(
			ts,
			ts.createSourceFile('dummy.' + scriptLang, scriptCode, ts.ScriptTarget.ESNext),
			scriptSetupCode !== undefined,
			false,
			false,
		) : undefined,
		scriptSetupCode !== undefined ? parseScriptSetupRanges(
			ts,
			ts.createSourceFile('dummy.' + scriptLang, scriptSetupCode, ts.ScriptTarget.ESNext)
		) : undefined,
		() => templateAst ? generateTemplateScript(templateAst) : undefined,
		() => cssVars ?? [],
		vueLibName,
	);

	return {
		code: generated.getText(),
		scriptMappings: getScriptMappings('script'),
		scriptSetupMappings: getScriptMappings('scriptSetup'),
	};

	function getScriptMappings(vueTag: 'script' | 'scriptSetup') {
		return generated.getMappings()
			.filter(mapping =>
				mapping.data.vueTag === vueTag
				&& mapping.data.capabilities.diagnostic
			)
			.map(mapping => ({
				sourceTextRange: mapping.sourceRange,
				generatedTextRange: mapping.mappedRange,
			}));
	}
}

/**
 * A wrapper function of `require('@vue/compiler-dom').compile`
 */
export function compileSFCTemplate(htmlCode: string, options: CompilerDOM.CompilerOptions = {}, vueVersion: 2 | 3 = 3) {

	const errors: CompilerDOM.CompilerError[] = [];
	const warnings: CompilerDOM.CompilerError[] = [];
	let ast: CompilerDOM.RootNode | undefined;

	try {
		ast = (vueVersion === 2 ? CompilerVue2 : CompilerDOM).compile(htmlCode, {
			onError: (err: CompilerDOM.CompilerError) => errors.push(err),
			onWarn: (err: CompilerDOM.CompilerError) => warnings.push(err),
			expressionPlugins: ['typescript'],
			...options,
		}).ast;
	}
	catch (e) {
		const err = e as CompilerDOM.CompilerError;
		errors.push(err);
	}

	return {
		errors,
		warnings,
		ast,
	};
}
