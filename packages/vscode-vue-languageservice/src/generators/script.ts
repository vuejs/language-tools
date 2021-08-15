import { createCodeGen } from '@volar/code-gen';
import { hyphenate } from '@vue/shared';
import * as path from 'upath';
import type * as templateGen from '../generators/template_scriptSetup';
import type { ScriptRanges } from '../parsers/scriptRanges';
import type { ScriptSetupRanges } from '../parsers/scriptSetupRanges';
import * as SourceMaps from '../utils/sourceMaps';

export function generate(
	lsType: 'template' | 'script',
	uri: string,
	script: null | {
		src?: string,
		content: string,
	},
	scriptSetup: null | {
		content: string,
	},
	scriptRanges: ScriptRanges | undefined,
	scriptSetupRanges: ScriptSetupRanges | undefined,
	htmlGen: ReturnType<typeof templateGen['generate']> | undefined,
) {

	const codeGen = createCodeGen<SourceMaps.TsMappingData>();
	const teleports: SourceMaps.Mapping<SourceMaps.TeleportMappingData>[] = [];
	const shouldAddExportDefault = lsType === 'script' && (!script || !!scriptSetup);
	const overlapMapRanges: SourceMaps.Range[] = [];

	writeScriptSrc();
	writeScript();
	writeScriptSetup();

	if (lsType === 'template' || shouldAddExportDefault)
		writeExportComponent();

	if (lsType === 'template') {
		writeExportOptions();
		writeConstNameOption();
	}

	if (lsType === 'script')
		writeTemplate();

	/**
	 * support find definition for <script> block less with:
	 * import Foo from './foo.vue'
	 *        ^^^      ^^^^^^^^^^^
	 */
	for (const overlapMapRange of overlapMapRanges) {
		codeGen.addMapping2({
			data: {
				vueTag: 'sfc',
				capabilities: {},
			},
			mode: SourceMaps.Mode.Overlap,
			sourceRange: {
				start: 0,
				end: 0,
			},
			mappedRange: overlapMapRange,
		});
	}

	return {
		...codeGen,
		teleports,
	};

	function writeScriptSrc() {
		if (!script?.src)
			return;

		let src = script.src;

		if (src.endsWith('.d.ts')) src = path.removeExt(src, '.d.ts');
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

		overlapMapRanges.push({
			start: 0,
			end: codeGen.getText().length
		});

	}
	function writeScript() {
		if (!script)
			return;

		let addText = script.content;
		if (shouldAddExportDefault && scriptRanges?.exportDefault) {
			const insteadOfExport = ' '.repeat('export'.length);
			const newStart = scriptRanges.exportDefault.start + insteadOfExport.length;
			addText = addText.substr(0, scriptRanges.exportDefault.start)
				+ insteadOfExport
				+ ' '.repeat(scriptRanges.exportDefault.expression.start - newStart)
				+ addText.substr(scriptRanges.exportDefault.expression.start);
		}
		codeGen.addCode(
			addText,
			{ start: 0, end: script.content.length },
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
		if (shouldAddExportDefault) {
			const start = codeGen.getText().length;
			codeGen.addText(`export default __VLS_defineComponent({\n`);
			overlapMapRanges.push({
				start,
				end: codeGen.getText().length,
			});
		}
		else {
			codeGen.addText(`\n`);
			codeGen.addText(`export const __VLS_component = __VLS_defineComponent({\n`);
		}
		if (script && scriptRanges?.exportDefault?.args) {
			const args = scriptRanges.exportDefault.args;
			codeGen.addText(`...(`);
			mapSubText('script', args.start, args.end);
			codeGen.addText(`),\n`);
		}
		if (scriptSetup && scriptSetupRanges) {
			if (scriptSetupRanges.propsRuntimeArg || scriptSetupRanges.propsTypeArg) {
				codeGen.addText(`props: (`);
				if (scriptSetupRanges.withDefaultsArg) codeGen.addText(`__VLS_mergePropDefaults(`);
				if (scriptSetupRanges.propsRuntimeArg) mapSubText('scriptSetup', scriptSetupRanges.propsRuntimeArg.start, scriptSetupRanges.propsRuntimeArg.end);
				else if (scriptSetupRanges.propsTypeArg) {
					codeGen.addText(`{} as __VLS_DefinePropsToOptions<`);
					mapSubText('scriptSetup', scriptSetupRanges.propsTypeArg.start, scriptSetupRanges.propsTypeArg.end);
					codeGen.addText(`>`);
				}
				if (scriptSetupRanges.withDefaultsArg) {
					codeGen.addText(`, `);
					mapSubText('scriptSetup', scriptSetupRanges.withDefaultsArg.start, scriptSetupRanges.withDefaultsArg.end);
					codeGen.addText(`)`);
				}
				codeGen.addText(`),\n`);
			}
			if (scriptSetupRanges.emitsRuntimeArg) {
				codeGen.addText(`emits: (`);
				mapSubText('scriptSetup', scriptSetupRanges.emitsRuntimeArg.start, scriptSetupRanges.emitsRuntimeArg.end);
				codeGen.addText(`),\n`);
			}
			else if (scriptSetupRanges.emitsTypeArg) {
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
			codeGen.addText(`return {\n`);
			if (lsType === 'template') {
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
			}
			codeGen.addText(`};\n`);
			codeGen.addText(`},\n`);
		}

		codeGen.addText(`});\n`);

		function mapSubText(vueTag: 'script' | 'scriptSetup', start: number, end: number) {
			for (const mapping of codeGen.getMappings()) {
				if (mapping.data.vueTag === vueTag && start >= mapping.sourceRange.start && end <= mapping.mappedRange.end) {
					teleports.push({
						data: {
							toSource: {
								capabilities: {
									references: true,
									definitions: true,
									rename: true,
								},
							},
							toTarget: {
								capabilities: {
									references: true,
									definitions: true,
									rename: true,
								},
							},
						},
						sourceRange: {
							start,
							end,
						},
						mappedRange: {
							start: codeGen.getText().length,
							end: codeGen.getText().length + end - start,
						},
						mode: SourceMaps.Mode.Offset,
					});
				}
			}
			codeGen.addText((vueTag === 'scriptSetup' ? scriptSetup : script)!.content.substring(start, end));
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
	function writeConstNameOption() {
		codeGen.addText(`\n`);
		if (script && scriptRanges?.exportDefault?.args) {
			const args = scriptRanges.exportDefault.args;
			codeGen.addText(`export const __VLS_name = __VLS_getNameOption(`);
			codeGen.addText(`${script.content.substring(args.start, args.end)} as const`);
			codeGen.addText(`);\n`);
		}
		else if (scriptSetup && path.extname(uri) === '.vue') {
			codeGen.addText(`export declare const __VLS_name: '${path.basename(path.trimExt(uri))}';\n`);
		}
		else {
			codeGen.addText(`export const __VLS_name = undefined;\n`);
		}
	}
	function writeTemplate() {
		if (!scriptSetup)
			return;
		if (!htmlGen)
			return;

		let bindingNames: string[] = [];

		if (scriptSetupRanges) {
			bindingNames = bindingNames.concat(scriptSetupRanges.bindings.map(range => scriptSetup?.content.substring(range.start, range.end) ?? ''));
		}
		if (scriptRanges) {
			bindingNames = bindingNames.concat(scriptRanges.bindings.map(range => script?.content.substring(range.start, range.end) ?? ''));
		}

		codeGen.addText('{\n');
		for (const varName of bindingNames) {
			if (htmlGen.tags.has(varName) || htmlGen.tags.has(hyphenate(varName))) {
				// fix import components unused report
				codeGen.addText(varName + ';\n');
			}
		}
		codeGen.addText(htmlGen.text);
		codeGen.addText('}\n');

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
}
