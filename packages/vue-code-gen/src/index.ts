import { generate as generateScript } from './generators/script';
import { generate as generateTemplateScript, isIntrinsicElement } from './generators/template';
import { parseScriptRanges } from './parsers/scriptRanges';
import { parseScriptSetupRanges } from './parsers/scriptSetupRanges';
import * as CompilerDOM from '@vue/compiler-dom';
import * as CompilerVue2 from './vue2TemplateCompiler';

export * from './types';
export * from '@vue/compiler-dom';
export { isIntrinsicElement };

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
	shimComponentOptions: boolean,
	downgradePropsAndEmitsToSetupReturnOnScriptSetup: boolean,
	templateAst?: CompilerDOM.RootNode,
	cssVars?: string[],
	vueLibName = 'vue',
) {

	const generated = generateScript(
		'script',
		'',
		scriptCode !== undefined ? { content: scriptCode } : undefined,
		scriptSetupCode !== undefined ? { content: scriptSetupCode } : undefined,
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
		() => undefined, // TODO
		// () => templateAst ? generateTemplateScript(templateAst) : undefined,
		() => cssVars ?? [],
		vueLibName,
		shimComponentOptions,
		downgradePropsAndEmitsToSetupReturnOnScriptSetup,
	);

	return {
		code: generated.codeGen.getText(),
		scriptMappings: getScriptMappings('script'),
		scriptSetupMappings: getScriptMappings('scriptSetup'),
	};

	function getScriptMappings(vueTag: 'script' | 'scriptSetup') {
		return generated.codeGen.getMappings()
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
export function compileSFCTemplate(htmlCode: string, options: CompilerDOM.CompilerOptions = {}, vueVersion: number) {

	const errors: CompilerDOM.CompilerError[] = [];
	const warnings: CompilerDOM.CompilerError[] = [];
	let ast: CompilerDOM.RootNode | undefined;

	try {
		ast = (vueVersion < 3 ? CompilerVue2 : CompilerDOM).compile(htmlCode, {
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
