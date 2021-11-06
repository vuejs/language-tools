import { generate as generateScript } from './generators/script';
import { generate as generateTemplateScript } from './generators/template_scriptSetup';
import { parseScriptRanges } from './parsers/scriptRanges';
import { parseScriptSetupRanges } from './parsers/scriptSetupRanges';
import * as CompilerDOM from '@vue/compiler-dom';

interface ScriptBlock {
	lang: 'js' | 'jsx' | 'ts' | 'tsx',
	content: string,
}

interface ScriptSetupBlock {
	lang: 'js' | 'jsx' | 'ts' | 'tsx',
	content: string,
	/**
	 * Template code AST generate by `@vue/compiler-dom`
	 * 
	 * Provide to resolve variables unused in script setup
	 */
	templateAst?: CompilerDOM.RootNode,
	/**
	 * `v-bind(...)` texts from script blocks
	 * 
	 * Provide to resolve variables unused in script setup
	 */
	styleBindTexts?: string[],
}

/**
 * Public API to resolve https://github.com/TypeStrong/fork-ts-checker-webpack-plugin/issues/668
 * @param ts typescript mmodule import from `typescript` or `typescript/lib/tsserverlibrary`
 * @param script `<script>` block
 * @param scriptSetup `<script setup>` block
 * @param vueLibName If use script setup, where should `defineComponent` and `PropType` import from? (`vue`, `@vue/runtime-dom`, `@vue/composition-api`)
 * @returns generated code and mappings
 */
export function generateScriptTypeCheckCode(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	script: ScriptBlock | undefined,
	scriptSetup: ScriptSetupBlock | undefined,
	vueLibName = 'vue',
) {

	const generated = generateScript(
		'script',
		'',
		script,
		scriptSetup,
		script ? parseScriptRanges(
			ts,
			ts.createSourceFile('dummy.' + script.lang, script.content, ts.ScriptTarget.ESNext),
			!!scriptSetup,
			false,
			false,
		) : undefined,
		scriptSetup ? parseScriptSetupRanges(
			ts,
			ts.createSourceFile('dummy.' + scriptSetup.lang, scriptSetup.content, ts.ScriptTarget.ESNext)
		) : undefined,
		() => scriptSetup?.templateAst ? generateTemplateScript(scriptSetup.templateAst) : undefined,
		() => scriptSetup?.styleBindTexts ?? [],
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
				originalTextRange: mapping.sourceRange,
				generatedTextRange: mapping.mappedRange,
			}));
	}
}
