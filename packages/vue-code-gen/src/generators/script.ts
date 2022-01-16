import { CodeGen } from '@volar/code-gen';
import * as SourceMaps from '@volar/source-map';
import { hyphenate } from '@vue/shared';
import * as path from 'upath';
import type * as templateGen from '../generators/template_scriptSetup';
import type { ScriptRanges } from '../parsers/scriptRanges';
import type { ScriptSetupRanges } from '../parsers/scriptSetupRanges';
import type { TeleportMappingData, TextRange, TsMappingData } from '../types';

export function generate(
	lsType: 'template' | 'script',
	fileName: string,
	script: undefined | {
		src?: string,
		content: string,
	},
	scriptSetup: undefined | {
		content: string,
	},
	scriptRanges: ScriptRanges | undefined,
	scriptSetupRanges: ScriptSetupRanges | undefined,
	getHtmlGen: () => ReturnType<typeof templateGen['generate']> | undefined,
	getStyleBindTexts: () => string[],
	vueLibName: string,
) {

	const codeGen = new CodeGen<TsMappingData>();
	const teleports: SourceMaps.Mapping<TeleportMappingData>[] = [];
	const usedTypes = {
		DefinePropsToOptions: false,
		ConstructorOverloads: false,
	};

	if (lsType === 'template') {
		codeGen.addText('// @ts-nocheck\n');
	}

	writeScriptSrc();
	writeScript();
	writeScriptSetup();

	if (lsType === 'script' && !script && !scriptSetup) {
		codeGen.addCode(
			'export default {} as any',
			{
				start: 0,
				end: 0,
			},
			SourceMaps.Mode.Expand,
			{
				vueTag: 'sfc',
				capabilities: {},
			},
		);
	}

	if (!!scriptSetup)
		writeExportComponent();

	if (usedTypes.DefinePropsToOptions) {
		codeGen.addText(`type __VLS_NonUndefinedable<T> = T extends undefined ? never : T;\n`);
		codeGen.addText(`type __VLS_DefinePropsToOptions<T> = { [K in keyof T]-?: {} extends Pick<T, K> ? { type: import('${vueLibName}').PropType<__VLS_NonUndefinedable<T[K]>> } : { type: import('${vueLibName}').PropType<T[K]>, required: true } };\n`);
	}
	if (usedTypes.ConstructorOverloads) {
		if (scriptSetupRanges && scriptSetupRanges.emitsTypeNums !== -1) {
			codeGen.addText(genConstructorOverloads('__VLS_ConstructorOverloads', scriptSetupRanges.emitsTypeNums));
		}
		else {
			codeGen.addText(
				genConstructorOverloads('__VLS_ConstructorOverloads'));
		}
	}

	if (lsType === 'template') {
		writeExportOptions();
		writeConstNameOption();
		writeExportTypes();
	}

	if (lsType === 'script' && scriptSetup) {
		// for code action edits
		codeGen.addCode(
			'',
			{
				start: scriptSetup.content.length,
				end: scriptSetup.content.length,
			},
			SourceMaps.Mode.Offset,
			{
				vueTag: 'scriptSetup',
				capabilities: {},
			},
		);
	}

	return {
		codeGen,
		teleports,
	};

	function writeScriptSrc() {
		if (!script?.src)
			return;

		let src = script.src;

		if (src.endsWith('.d.ts')) src = path.removeExt(path.removeExt(src, '.ts'), '.d');
		else if (src.endsWith('.ts')) src = path.removeExt(src, '.ts');
		else if (src.endsWith('.tsx')) src = path.removeExt(src, '.tsx');

		codeGen.addText(`export * from `);
		codeGen.addCode(
			`'${src}'`,
			{ start: -1, end: -1 },
			SourceMaps.Mode.Offset,
			{
				vueTag: 'scriptSrc',
				capabilities: {
					basic: lsType === 'script',
					references: true,
					definitions: lsType === 'script',
					rename: true,
					diagnostic: lsType === 'script',
					formatting: lsType === 'script',
					completion: lsType === 'script',
					semanticTokens: lsType === 'script',
					foldingRanges: lsType === 'script',
				},
			}
		);
		codeGen.addText(`;\n`);
		codeGen.addText(`export { default } from '${src}';\n`);
	}
	function writeScript() {
		if (!script)
			return;

		const sections: (TextRange | string)[] = [];

		if (!!scriptSetup && scriptRanges?.exportDefault) {
			sections.push({ start: 0, end: scriptRanges.exportDefault.start });
			sections.push('await' + ' '.repeat(scriptRanges.exportDefault.expression.start - scriptRanges.exportDefault.start - 'await'.length));
			sections.push({ start: scriptRanges.exportDefault.expression.start, end: script.content.length });
		}
		else {
			sections.push({ start: 0, end: script.content.length });
		}

		for (const section of sections) {
			if (typeof section === 'string') {
				codeGen.addText(section);
			}
			else {
				codeGen.addCode(
					script.content.substring(section.start, section.end),
					section,
					SourceMaps.Mode.Offset,
					{
						vueTag: 'script',
						capabilities: {
							basic: lsType === 'script',
							references: true,
							definitions: lsType === 'script',
							rename: true,
							diagnostic: true, // also working for setup() returns unused in template checking
							formatting: lsType === 'script',
							completion: lsType === 'script',
							semanticTokens: lsType === 'script',
							foldingRanges: lsType === 'script',
						},
					}
				);
			}
		}
	}
	function writeScriptSetup() {
		if (!scriptSetup)
			return;

		codeGen.addCode(
			scriptSetup.content,
			{
				start: 0,
				end: scriptSetup.content.length,
			},
			SourceMaps.Mode.Offset,
			{
				vueTag: 'scriptSetup',
				capabilities: {
					basic: lsType === 'script',
					references: true,
					definitions: lsType === 'script',
					diagnostic: lsType === 'script',
					rename: true,
					completion: lsType === 'script',
					semanticTokens: lsType === 'script',
				},
			},
		);
	}
	function writeExportComponent() {

		codeGen.addText(`export default (await import('${vueLibName}')).defineComponent({\n`);

		if (script && scriptRanges?.exportDefault?.args) {
			const args = scriptRanges.exportDefault.args;
			codeGen.addText(`...(`);
			mapSubText('script', args.start, args.end);
			codeGen.addText(`),\n`);
		}
		if (scriptSetup && scriptSetupRanges) {
			if (scriptSetupRanges.propsRuntimeArg || scriptSetupRanges.propsTypeArg) {
				codeGen.addText(`props: (`);
				if (scriptSetupRanges.propsRuntimeArg) {
					mapSubText('scriptSetup', scriptSetupRanges.propsRuntimeArg.start, scriptSetupRanges.propsRuntimeArg.end);
				}
				else if (scriptSetupRanges.propsTypeArg) {
					usedTypes.DefinePropsToOptions = true;
					codeGen.addText(`{} as __VLS_DefinePropsToOptions<`);
					mapSubText('scriptSetup', scriptSetupRanges.propsTypeArg.start, scriptSetupRanges.propsTypeArg.end);
					codeGen.addText(`>`);
				}
				codeGen.addText(`),\n`);
			}
			if (scriptSetupRanges.emitsRuntimeArg) {
				codeGen.addText(`emits: (`);
				mapSubText('scriptSetup', scriptSetupRanges.emitsRuntimeArg.start, scriptSetupRanges.emitsRuntimeArg.end);
				codeGen.addText(`),\n`);
			}
			else if (scriptSetupRanges.emitsTypeArg) {
				usedTypes.ConstructorOverloads = true;
				codeGen.addText(`emits: ({} as __VLS_ConstructorOverloads<`);
				mapSubText('scriptSetup', scriptSetupRanges.emitsTypeArg.start, scriptSetupRanges.emitsTypeArg.end);
				codeGen.addText(`>),\n`);
			}
			const bindingsArr: {
				bindings: { start: number, end: number }[],
				content: string,
				vueTag: 'script' | 'scriptSetup',
			}[] = [];
			if (scriptSetupRanges) {
				bindingsArr.push({
					bindings: scriptSetupRanges.bindings,
					content: scriptSetup.content,
					vueTag: 'scriptSetup',
				});
			}
			if (scriptRanges && script) {
				bindingsArr.push({
					bindings: scriptRanges.bindings,
					content: script.content,
					vueTag: 'script',
				});
			}

			codeGen.addText(`setup() {\n`);

			if (lsType === 'script') {
				codeGen.addText(`() => {\n`);
				for (const bindText of getStyleBindTexts()) {
					codeGen.addText('// @ts-ignore\n');
					codeGen.addText(bindText + ';\n');
				}
				writeTemplate();
				codeGen.addText(`};\n`);

				if (scriptSetupRanges.exposeRuntimeArg) {
					codeGen.addText(`return `);
					mapSubText('scriptSetup', scriptSetupRanges.exposeRuntimeArg.start, scriptSetupRanges.exposeRuntimeArg.end);
					codeGen.addText(`;\n`);
				}
				else {
					codeGen.addText(`return { };\n`);
				};
			}

			if (lsType === 'template') {
				codeGen.addText(`return {\n`);
				for (const { bindings, content } of bindingsArr) {
					for (const expose of bindings) {
						const varName = content.substring(expose.start, expose.end);
						const templateSideRange = codeGen.addText(varName);
						codeGen.addText(`: `);
						const scriptSideRange = codeGen.addText(varName);
						codeGen.addText(',\n');

						teleports.push({
							sourceRange: scriptSideRange,
							mappedRange: templateSideRange,
							mode: SourceMaps.Mode.Offset,
							data: {
								toSource: {
									capabilities: {
										definitions: true,
										references: true,
										rename: true,
									},
								},
								toTarget: {
									capabilities: {
										definitions: true,
										references: true,
										rename: true,
									},
								},
							},
						});
					}
				}
				codeGen.addText(`};\n`);
			}
			codeGen.addText(`},\n`);
		}

		codeGen.addText(`});\n`);

		function mapSubText(vueTag: 'script' | 'scriptSetup', start: number, end: number) {
			codeGen.addCode(
				(vueTag === 'scriptSetup' ? scriptSetup : script)!.content.substring(start, end),
				{ start, end },
				SourceMaps.Mode.Offset,
				{
					vueTag,
					capabilities: {
						references: true,
						definitions: true,
						rename: true,
					},
				},
			);
		}
	}
	function writeExportOptions() {
		codeGen.addText(`\n`);
		codeGen.addText(`export const __VLS_options = {\n`);
		if (script && scriptRanges?.exportDefault?.args) {
			const args = scriptRanges.exportDefault.args;
			codeGen.addText(`...(`);
			codeGen.addCode(
				script.content.substring(args.start, args.end),
				args,
				SourceMaps.Mode.Offset,
				{
					vueTag: 'script',
					capabilities: {
						references: true,
						rename: true,
					},
				},
			);
			codeGen.addText(`),\n`);
		}
		if (scriptSetupRanges?.propsRuntimeArg && scriptSetup) {
			codeGen.addText(`props: (`);
			codeGen.addCode(
				scriptSetup.content.substring(scriptSetupRanges.propsRuntimeArg.start, scriptSetupRanges.propsRuntimeArg.end),
				scriptSetupRanges.propsRuntimeArg,
				SourceMaps.Mode.Offset,
				{
					vueTag: 'scriptSetup',
					capabilities: {
						references: true,
						definitions: true,
						rename: true,
					},
				},
			);
			codeGen.addText(`),\n`);
		}
		if (scriptSetupRanges?.propsTypeArg && scriptSetup) {
			codeGen.addText(`props: ({} as `);
			codeGen.addCode(
				scriptSetup.content.substring(scriptSetupRanges.propsTypeArg.start, scriptSetupRanges.propsTypeArg.end),
				scriptSetupRanges.propsTypeArg,
				SourceMaps.Mode.Offset,
				{
					vueTag: 'scriptSetup',
					capabilities: {
						references: true,
						definitions: true,
						rename: true,
					},
				},
			);
			codeGen.addText(`),\n`);
		}
		if (scriptSetupRanges?.emitsRuntimeArg && scriptSetup) {
			codeGen.addText(`emits: (`);
			codeGen.addCode(
				scriptSetup.content.substring(scriptSetupRanges.emitsRuntimeArg.start, scriptSetupRanges.emitsRuntimeArg.end),
				scriptSetupRanges.emitsRuntimeArg,
				SourceMaps.Mode.Offset,
				{
					vueTag: 'scriptSetup',
					capabilities: {
						references: true,
						definitions: true,
						rename: true,
					},
				},
			);
			codeGen.addText(`),\n`);
		}
		if (scriptSetupRanges?.emitsTypeArg && scriptSetup) {
			codeGen.addText(`emits: ({} as `);
			codeGen.addCode(
				scriptSetup.content.substring(scriptSetupRanges.emitsTypeArg.start, scriptSetupRanges.emitsTypeArg.end),
				scriptSetupRanges.emitsTypeArg,
				SourceMaps.Mode.Offset,
				{
					vueTag: 'scriptSetup',
					capabilities: {},
				},
			);
			codeGen.addText(`),\n`);
		}
		codeGen.addText(`};\n`);
	}
	function writeExportTypes() {

		const bindingsArr: {
			typeBindings: { start: number, end: number }[],
			content: string,
		}[] = [];

		if (scriptSetupRanges && scriptSetup) {
			bindingsArr.push({
				typeBindings: scriptSetupRanges.typeBindings,
				content: scriptSetup.content,
			});
		}
		// if (scriptRanges && script) {
		// 	bindingsArr.push({
		// 		typeBindings: scriptRanges.typeBindings,
		// 		content: script.content,
		// 	});
		// }

		codeGen.addText('export {\n');
		for (const bindings of bindingsArr) {
			for (const typeBinding of bindings.typeBindings) {
				const text = bindings.content.substring(typeBinding.start, typeBinding.end);
				codeGen.addText(`${text} as __VLS_types_${text},\n`);
			}
		}
		codeGen.addText('};\n');
	}
	function writeConstNameOption() {
		codeGen.addText(`\n`);
		if (script && scriptRanges?.exportDefault?.args) {
			const args = scriptRanges.exportDefault.args;
			codeGen.addText(`export const __VLS_name = (await import('./__VLS_types')).getNameOption(`);
			codeGen.addText(`${script.content.substring(args.start, args.end)} as const`);
			codeGen.addText(`);\n`);
		}
		else if (scriptSetup) {
			codeGen.addText(`export declare const __VLS_name: '${path.basename(path.removeExt(fileName, '.vue'))}';\n`);
		}
		else {
			codeGen.addText(`export const __VLS_name = undefined;\n`);
		}
	}
	function writeTemplate() {

		const htmlGen = getHtmlGen();
		if (!htmlGen)
			return;

		let bindingNames: string[] = [];

		if (scriptSetupRanges) {
			bindingNames = bindingNames.concat(scriptSetupRanges.bindings.map(range => scriptSetup?.content.substring(range.start, range.end) ?? ''));
		}
		if (scriptRanges) {
			bindingNames = bindingNames.concat(scriptRanges.bindings.map(range => script?.content.substring(range.start, range.end) ?? ''));
		}

		// fix import components unused report
		for (const varName of bindingNames) {
			if (htmlGen.tags.has(varName) || htmlGen.tags.has(hyphenate(varName))) {
				codeGen.addText('// @ts-ignore\n');
				codeGen.addText(varName + ';\n');
			}
		}
		for (const tag of htmlGen.tags) {
			if (tag.indexOf('.') >= 0) {
				codeGen.addText('// @ts-ignore\n');
				codeGen.addText(tag + ';\n');
			}
		}

		codeGen.addText(htmlGen.text);
	}
}

// TODO: not working for overloads > n (n = 8)
// see: https://github.com/johnsoncodehk/volar/issues/60
export function genConstructorOverloads(name = 'ConstructorOverloads', nums?: number) {
	let code = `type ${name}<T> =\n`;
	if (nums === undefined) {
		for (let i = 8; i >= 1; i--) {
			gen(i);
		}
	}
	else {
		gen(nums);
	}
	code += `// 0\n`
	code += `{};\n`
	return code;

	function gen(i: number) {
		code += `// ${i}\n`;
		code += `T extends {\n`;
		for (let j = 1; j <= i; j++) {
			code += `(event: infer E${j}, ...payload: infer P${j}): void;\n`
		}
		code += `} ? (\n`
		for (let j = 1; j <= i; j++) {
			if (j > 1) code += '& ';
			code += `(E${j} extends string ? { [K${j} in E${j}]: (...payload: P${j}) => void } : {})\n`;
		}
		code += `) :\n`;
	}
}
