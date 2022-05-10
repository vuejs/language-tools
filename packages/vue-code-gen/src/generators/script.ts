import { CodeGen } from '@volar/code-gen';
import * as SourceMaps from '@volar/source-map';
import { hyphenate } from '@vue/shared';
import * as path from 'path';
import type * as templateGen from '../generators/template';
import type { ScriptRanges } from '../parsers/scriptRanges';
import type { ScriptSetupRanges } from '../parsers/scriptSetupRanges';
import type { TeleportMappingData, EmbeddedFileMappingData } from '../types';

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
	shimComponentOptions: boolean,
) {

	const codeGen = new CodeGen<EmbeddedFileMappingData>();
	const teleports: SourceMaps.Mapping<TeleportMappingData>[] = [];
	const usedTypes = {
		DefinePropsToOptions: false,
		mergePropDefaults: false,
		ConstructorOverloads: false,
	};
	let shimedComponentOptions = false;

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

	if (usedTypes.DefinePropsToOptions) {
		codeGen.addText(`type __VLS_NonUndefinedable<T> = T extends undefined ? never : T;\n`);
		codeGen.addText(`type __VLS_TypePropsToRuntimeProps<T> = { [K in keyof T]-?: {} extends Pick<T, K> ? { type: import('${vueLibName}').PropType<__VLS_NonUndefinedable<T[K]>> } : { type: import('${vueLibName}').PropType<T[K]>, required: true } };\n`);
	}
	if (usedTypes.mergePropDefaults) {
		codeGen.addText(`type __VLS_WithDefaults<P, D> = {
			// use 'keyof Pick<P, keyof P>' instead of 'keyof P' to keep props jsdoc
			[K in keyof Pick<P, keyof P>]: K extends keyof D ? P[K] & {
				default: D[K]
			} : P[K]
		};\n`);
	}
	if (usedTypes.ConstructorOverloads) {
		// fix https://github.com/johnsoncodehk/volar/issues/926
		codeGen.addText('type __VLS_UnionToIntersection<U> = (U extends unknown ? (arg: U) => unknown : never) extends ((arg: infer P) => unknown) ? P : never;\n');
		if (scriptSetupRanges && scriptSetupRanges.emitsTypeNums !== -1) {
			codeGen.addText(genConstructorOverloads('__VLS_ConstructorOverloads', scriptSetupRanges.emitsTypeNums));
		}
		else {
			codeGen.addText(genConstructorOverloads('__VLS_ConstructorOverloads'));
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

	// fix https://github.com/johnsoncodehk/volar/issues/1048
	// fix https://github.com/johnsoncodehk/volar/issues/435
	// fix https://github.com/johnsoncodehk/volar/issues/1127
	codeGen.addMapping2({
		data: {
			vueTag: 'sfc',
			capabilities: {
				diagnostic: lsType === 'script',
			},
		},
		mode: SourceMaps.Mode.Expand,
		mappedRange: {
			start: 0,
			end: codeGen.getText().length,
		},
		sourceRange: {
			start: 0,
			end: 0,
		},
	});

	return {
		codeGen,
		teleports,
		shimedComponentOptions,
	};

	function writeScriptSrc() {
		if (!script?.src)
			return;

		let src = script.src;

		if (src.endsWith('.d.ts')) src = src.substring(0, src.length - '.d.ts'.length);
		else if (src.endsWith('.ts')) src = src.substring(0, src.length - '.ts'.length);
		else if (src.endsWith('.tsx')) src = src.substring(0, src.length - '.tsx'.length);

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
					completion: lsType === 'script',
					semanticTokens: lsType === 'script',
				},
			}
		);
		codeGen.addText(`;\n`);
		codeGen.addText(`export { default } from '${src}';\n`);
	}
	function writeScript() {
		if (!script)
			return;

		if (!!scriptSetup && scriptRanges?.exportDefault) {
			addVirtualCode('script', 0, scriptRanges.exportDefault.start);
			addVirtualCode('script', scriptRanges.exportDefault.end, script.content.length);
		}
		else {
			let isExportRawObject = false;
			if (scriptRanges?.exportDefault) {
				isExportRawObject = script.content.substring(scriptRanges.exportDefault.expression.start, scriptRanges.exportDefault.expression.end).startsWith('{');
			}
			if (isExportRawObject && shimComponentOptions && scriptRanges?.exportDefault) {
				shimedComponentOptions = true;
				addVirtualCode('script', 0, scriptRanges.exportDefault.expression.start);
				codeGen.addText(`(await import('${vueLibName}')).defineComponent(`);
				addVirtualCode('script', scriptRanges.exportDefault.expression.start, scriptRanges.exportDefault.expression.end);
				codeGen.addText(`)`);
				addVirtualCode('script', scriptRanges.exportDefault.expression.end, script.content.length);
			}
			else {
				addVirtualCode('script', 0, script.content.length);
			}
		}
	}
	function addVirtualCode(vueTag: 'script' | 'scriptSetup', start: number, end: number) {
		codeGen.addCode(
			(vueTag === 'script' ? script : scriptSetup)!.content.substring(start, end),
			{ start, end },
			SourceMaps.Mode.Offset,
			{
				vueTag: vueTag,
				capabilities: {
					basic: lsType === 'script',
					references: true,
					definitions: lsType === 'script',
					rename: true,
					diagnostic: true, // also working for setup() returns unused in template checking
					completion: lsType === 'script',
					semanticTokens: lsType === 'script',
				},
			}
		);
	}
	function addExtraReferenceVirtualCode(vueTag: 'script' | 'scriptSetup', start: number, end: number) {
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
	function writeScriptSetup() {

		if (!scriptSetup)
			return;

		if (!scriptSetupRanges)
			return;

		codeGen.addCode(
			scriptSetup.content.substring(0, scriptSetupRanges.importSectionEndOffset),
			{
				start: 0,
				end: scriptSetupRanges.importSectionEndOffset,
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

		codeGen.addText('export default await (async () => {\n');
		codeGen.addCode(
			scriptSetup.content.substring(scriptSetupRanges.importSectionEndOffset),
			{
				start: scriptSetupRanges.importSectionEndOffset,
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

		if (scriptSetupRanges?.withDefaultsArg) {
			// fix https://github.com/johnsoncodehk/volar/issues/1187
			codeGen.addText(`const __VLS_withDefaultsArg = (<T>(t: T) => t)(`);
			addExtraReferenceVirtualCode('scriptSetup', scriptSetupRanges.withDefaultsArg.start, scriptSetupRanges.withDefaultsArg.end);
			codeGen.addText(`);\n`);
		}

		codeGen.addText(`// @ts-ignore\n`); // fix https://github.com/johnsoncodehk/volar/issues/1263
		codeGen.addText(`return (await import('${vueLibName}')).defineComponent({\n`);

		if (script && scriptRanges?.exportDefault?.args) {
			const args = scriptRanges.exportDefault.args;
			codeGen.addText(`...(`);
			addVirtualCode('script', args.start, args.end);
			codeGen.addText(`),\n`);
		}
		if (scriptSetup && scriptSetupRanges) {
			if (scriptSetupRanges.propsRuntimeArg || scriptSetupRanges.propsTypeArg) {
				codeGen.addText(`props: (`);
				if (scriptSetupRanges.propsTypeArg) {

					usedTypes.DefinePropsToOptions = true;
					codeGen.addText(`{} as `);

					if (scriptSetupRanges.withDefaultsArg) {
						usedTypes.mergePropDefaults = true;
						codeGen.addText(`__VLS_WithDefaults<`);
					}

					codeGen.addText(`__VLS_TypePropsToRuntimeProps<`);
					addExtraReferenceVirtualCode('scriptSetup', scriptSetupRanges.propsTypeArg.start, scriptSetupRanges.propsTypeArg.end);
					codeGen.addText(`>`);

					if (scriptSetupRanges.withDefaultsArg) {
						codeGen.addText(`, typeof __VLS_withDefaultsArg`);
						codeGen.addText(`>`);
					}
				}
				else if (scriptSetupRanges.propsRuntimeArg) {
					addExtraReferenceVirtualCode('scriptSetup', scriptSetupRanges.propsRuntimeArg.start, scriptSetupRanges.propsRuntimeArg.end);
				}
				codeGen.addText(`),\n`);
			}
			if (scriptSetupRanges.emitsTypeArg) {
				usedTypes.ConstructorOverloads = true;
				codeGen.addText(`emits: ({} as __VLS_UnionToIntersection<__VLS_ConstructorOverloads<`);
				addExtraReferenceVirtualCode('scriptSetup', scriptSetupRanges.emitsTypeArg.start, scriptSetupRanges.emitsTypeArg.end);
				codeGen.addText(`>>),\n`);
			}
			else if (scriptSetupRanges.emitsRuntimeArg) {
				codeGen.addText(`emits: (`);
				addExtraReferenceVirtualCode('scriptSetup', scriptSetupRanges.emitsRuntimeArg.start, scriptSetupRanges.emitsRuntimeArg.end);
				codeGen.addText(`),\n`);
			}
			const bindingsArr: {
				bindings: { start: number, end: number; }[],
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

				if (scriptSetupRanges.exposeTypeArg) {
					codeGen.addText(`return { } as `);
					addExtraReferenceVirtualCode('scriptSetup', scriptSetupRanges.exposeTypeArg.start, scriptSetupRanges.exposeTypeArg.end);
					codeGen.addText(`;\n`);
				}
				else if (scriptSetupRanges.exposeRuntimeArg) {
					codeGen.addText(`return `);
					addExtraReferenceVirtualCode('scriptSetup', scriptSetupRanges.exposeRuntimeArg.start, scriptSetupRanges.exposeRuntimeArg.end);
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
		codeGen.addText(`})();\n`);
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
		else if (scriptSetupRanges?.propsTypeArg && scriptSetup) {
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
		else if (scriptSetupRanges?.emitsTypeArg && scriptSetup) {
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
			typeBindings: { start: number, end: number; }[],
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
			codeGen.addText(`export declare const __VLS_name: '${path.basename(fileName.substring(0, fileName.lastIndexOf('.')))}';\n`);
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
		codeGen.addText('// @ts-ignore\n');
		codeGen.addText('[');
		for (const varName of bindingNames) {
			if (!!htmlGen.tagNames[varName] || !!htmlGen.tagNames[hyphenate(varName)]) {
				codeGen.addText(varName + ', ');
			}
		}
		for (const tag of Object.keys(htmlGen.tagNames)) {
			if (tag.indexOf('.') >= 0) {
				codeGen.addText(tag + ', ');
			}
		}
		codeGen.addText('];\n');

		codeGen.addText('// @ts-ignore\n');
		codeGen.addText('[');
		codeGen.addText([...htmlGen.identifiers].join(', '));
		codeGen.addText('];\n');
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
	code += `// 0\n`;
	code += `{};\n`;
	return code;

	function gen(i: number) {
		code += `// ${i}\n`;
		code += `T extends {\n`;
		for (let j = 1; j <= i; j++) {
			code += `(event: infer E${j}, ...payload: infer P${j}): void;\n`;
		}
		code += `} ? (\n`;
		for (let j = 1; j <= i; j++) {
			if (j > 1) code += '& ';
			code += `(E${j} extends string ? { [K${j} in E${j}]: (...payload: P${j}) => void } : {})\n`;
		}
		code += `) :\n`;
	}
}
