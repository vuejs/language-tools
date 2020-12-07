import { TextDocument } from 'vscode-languageserver-textdocument';
import { syntaxToLanguageId, getValidScriptSyntax } from '@volar/shared';
import { computed, Ref } from '@vue/reactivity';
import { IDescriptor } from '../types';
import { MapedMode, TsSourceMap, TsMappingData, MapedRange, SourceMap } from '../utils/sourceMaps';
import { SearchTexts } from './common';
import { getCheapTsService } from '../globalServices';
import * as ts from 'typescript';
import * as upath from 'upath';

export let rfc: '#182' | '#222' = '#222';
export function setScriptSetupRfc(_rfc: string) {
	switch (_rfc) {
		case '#182':
		case '#222':
			rfc = _rfc;
			break;
	}
}
export function useScriptSetupGen(
	getUnreactiveDoc: () => TextDocument,
	script: Ref<IDescriptor['script']>,
	scriptSetup: Ref<IDescriptor['scriptSetup']>,
) {
	let version = 0;
	const scriptData = computed(() => {
		if (script.value) {
			return getScriptData(script.value.content);
		}
	});
	const scriptSetupData = computed(() => {
		if (scriptSetup.value) {
			return getScriptSetupData(scriptSetup.value.content);
		}
	});
	const defaultExport = computed(() => {
		if (scriptSetupData.value?.exportDefault) {
			return {
				tag: 'scriptSetup',
				text: scriptSetupData.value.exportDefault.args.text,
				start: scriptSetupData.value.exportDefault.args.start,
				end: scriptSetupData.value.exportDefault.args.end,
			};
		}
		if (scriptData.value?.exportDefault) {
			return {
				tag: 'script',
				text: scriptData.value.exportDefault.args.text,
				start: scriptData.value.exportDefault.args.start,
				end: scriptData.value.exportDefault.args.end,
			};
		}
		return undefined;
	});
	const scriptSetupGenResult = computed(() => {
		if (scriptSetup.value && scriptSetupData.value) {
			const vueDoc = getUnreactiveDoc();
			return genScriptSetup(vueDoc.uri, scriptSetup.value.content, scriptSetup.value.setup, scriptSetupData.value);
		}
	});
	const docGen = computed(() => {
		if (!script.value && !scriptSetup.value) return;

		let code = '';
		let scriptRange: MapedRange | undefined;
		let scriptSetupRange: MapedRange | undefined;
		let defaultExportRange: {
			partRange: MapedRange,
			genRange: MapedRange,
			tag: string,
		} | undefined;
		let definePropsRange: {
			partRange: MapedRange,
			genRange: MapedRange,
		} | undefined;
		let defineEmitRange: {
			partRange: MapedRange,
			genRange: MapedRange,
		} | undefined;

		if (script.value) {
			if (scriptSetup.value && scriptData.value?.exportDefault) {
				scriptRange = addCode(replaceStringToEmpty(script.value.content, scriptData.value.exportDefault.start, scriptData.value.exportDefault.end));
			}
			else {
				scriptRange = addCode(script.value.content);
			}
		}
		if (scriptSetupGenResult.value) {
			scriptSetupRange = addCode(scriptSetupGenResult.value.code);
		}
		code += `\n`;
		code += `export const __VLS_options = {\n`;
		code += `...(`;
		if (defaultExport.value) {
			defaultExportRange = {
				tag: defaultExport.value.tag,
				partRange: defaultExport.value,
				genRange: addCode(defaultExport.value.text),
			};
		}
		else {
			code += `{}`;
		}
		code += `),\n`;
		if (scriptSetupGenResult.value?.declaresNames.has('props')) {
			code += `props: __VLS_declares_props,\n`;
		}
		if (scriptSetupData.value?.defineProps?.args && scriptSetup.value) {
			code += `props: (`;
			const text = scriptSetup.value.content.substring(scriptSetupData.value.defineProps.args.start, scriptSetupData.value.defineProps.args.end);
			definePropsRange = {
				partRange: scriptSetupData.value.defineProps.args,
				genRange: addCode(text),
			};
			code += `),\n`;
		}
		if (scriptSetupData.value?.defineProps?.typeArgs && scriptSetup.value) {
			code += `props: ({} as `;
			const text = scriptSetup.value.content.substring(scriptSetupData.value.defineProps.typeArgs.start, scriptSetupData.value.defineProps.typeArgs.end);
			definePropsRange = {
				partRange: scriptSetupData.value.defineProps.typeArgs,
				genRange: addCode(text),
			};
			code += `),\n`;
		}
		if (scriptSetupData.value?.defineEmit?.args && scriptSetup.value) {
			code += `emits: (`;
			const text = scriptSetup.value.content.substring(scriptSetupData.value.defineEmit.args.start, scriptSetupData.value.defineEmit.args.end);
			defineEmitRange = {
				partRange: scriptSetupData.value.defineEmit.args,
				genRange: addCode(text),
			};
			code += `),\n`;
		}
		code += `};\n`;

		return {
			code,
			scriptRange,
			scriptSetupRange,
			defaultExportRange,
			definePropsRange,
			defineEmitRange,
		};

		function addCode(str: string) {
			const start = code.length;
			code += str;
			return {
				start,
				end: code.length
			};
		}
	});
	const textDocument = computed(() => {
		if (!docGen.value) return;

		const vueDoc = getUnreactiveDoc();
		const lang = getValidScriptSyntax(scriptSetup.value?.lang ?? script.value?.lang ?? 'js');
		const uri = `${vueDoc.uri}.__VLS_script.${lang}`;

		return TextDocument.create(uri, syntaxToLanguageId(lang), version++, docGen.value.code);
	});
	const sourceMap = computed(() => {
		if (!docGen.value) return;
		if (!textDocument.value) return;

		const vueDoc = getUnreactiveDoc();
		const sourceMap = new TsSourceMap(vueDoc, textDocument.value, false, { foldingRanges: true, formatting: true });

		if (script.value && docGen.value.scriptRange) {
			sourceMap.add({
				data: {
					vueTag: 'script',
					capabilities: {
						basic: true,
						references: true,
						rename: true,
						diagnostic: true,
						formatting: true,
						completion: true,
						semanticTokens: true,
						foldingRanges: true,
					},
				},
				mode: MapedMode.Offset,
				sourceRange: {
					start: script.value.loc.start,
					end: script.value.loc.end,
				},
				targetRange: docGen.value.scriptRange,
			});
		}
		if (scriptSetup.value && scriptSetupGenResult.value && docGen.value.scriptSetupRange) {
			const vueDoc = getUnreactiveDoc();
			for (const mapping of scriptSetupGenResult.value.mappings) {
				sourceMap.add({
					data: {
						vueTag: 'scriptSetup',
						isNoDollarRef: mapping.isNoDollarRef,
						capabilities: mapping.capabilities,
					},
					mode: mapping.mode,
					sourceRange: {
						start: scriptSetup.value.loc.start + mapping.scriptSetupRange.start,
						end: scriptSetup.value.loc.start + mapping.scriptSetupRange.end,
					},
					targetRange: {
						start: docGen.value.scriptSetupRange.start + mapping.genRange.start,
						end: docGen.value.scriptSetupRange.start + mapping.genRange.end,
					},
				});
			}
			{
				const setup = scriptSetup.value.setup;
				const vueStart = vueDoc.getText().substring(0, scriptSetup.value.loc.start).lastIndexOf(setup); // TODO: don't use indexOf()
				const vueEnd = vueStart + setup.length;
				const tsStart = docGen.value.code.indexOf(`${setup}${SearchTexts.SetupParams}`);
				const tsEnd = tsStart + setup.length;
				sourceMap.add({
					data: {
						vueTag: 'scriptSetup',
						capabilities: {
							basic: true,
							references: true,
							rename: true,
							diagnostic: true,
							completion: true,
							semanticTokens: true,
						},
					},
					mode: MapedMode.Offset,
					sourceRange: {
						start: vueStart,
						end: vueEnd,
					},
					targetRange: {
						start: tsStart,
						end: tsEnd,
					},
				});
			}
		}
		if (docGen.value.defaultExportRange) {
			const optionsRange = docGen.value.defaultExportRange;
			const block = optionsRange.tag === 'scriptSetup' ? scriptSetup.value : script.value;
			if (block) {
				const optionsVueRange = {
					start: block.loc.start + optionsRange.partRange.start,
					end: block.loc.start + optionsRange.partRange.end,
				};
				sourceMap.add({
					data: {
						vueTag: scriptSetup.value ? 'scriptSetup' : 'script',
						capabilities: {
							basic: false,
							references: true,
							rename: true,
							diagnostic: false,
							formatting: false,
							completion: false,
							semanticTokens: false,
						},
					},
					mode: MapedMode.Offset,
					sourceRange: optionsVueRange,
					targetRange: optionsRange.genRange,
				});
			}
		}
		if (docGen.value.definePropsRange && scriptSetup.value) {
			const optionsVueRange = {
				start: scriptSetup.value.loc.start + docGen.value.definePropsRange.partRange.start,
				end: scriptSetup.value.loc.start + docGen.value.definePropsRange.partRange.end,
			};
			sourceMap.add({
				data: {
					vueTag: 'scriptSetup',
					capabilities: {
						basic: false,
						references: true,
						rename: true,
						diagnostic: false,
						formatting: false,
						completion: false,
						semanticTokens: false,
					},
				},
				mode: MapedMode.Offset,
				sourceRange: optionsVueRange,
				targetRange: docGen.value.definePropsRange.genRange,
			});
		}
		if (docGen.value.defineEmitRange && scriptSetup.value) {
			const optionsVueRange = {
				start: scriptSetup.value.loc.start + docGen.value.defineEmitRange.partRange.start,
				end: scriptSetup.value.loc.start + docGen.value.defineEmitRange.partRange.end,
			};
			sourceMap.add({
				data: {
					vueTag: 'scriptSetup',
					capabilities: {
						basic: false,
						references: true,
						rename: true,
						diagnostic: false,
						formatting: false,
						completion: false,
						semanticTokens: false,
					},
				},
				mode: MapedMode.Offset,
				sourceRange: optionsVueRange,
				targetRange: docGen.value.defineEmitRange.genRange,
			});
		}

		return sourceMap;
	});
	const mirrorsSourceMap = computed(() => {
		if (scriptSetupGenResult.value && textDocument.value) {
			const startOffset = script.value?.content.length ?? 0;
			const sourceMap = new SourceMap(
				textDocument.value,
				textDocument.value,
			);
			for (const maped of scriptSetupGenResult.value.mirrors) {
				sourceMap.add({
					mode: MapedMode.Offset,
					sourceRange: {
						start: startOffset + maped.left.start,
						end: startOffset + maped.left.end,
					},
					targetRange: {
						start: startOffset + maped.right.start,
						end: startOffset + maped.right.end,
					},
					data: undefined,
				});
			}
			return sourceMap;
		}
	});
	const shadowTsTextDocument = computed(() => {
		if (textDocument.value?.languageId === 'javascript') {
			const vueDoc = getUnreactiveDoc();
			const lang = 'ts';
			const uri = `${vueDoc.uri}.__VLS_script.${lang}`;
			return TextDocument.create(uri, syntaxToLanguageId(lang), textDocument.value.version, textDocument.value.getText());
		}
	});
	const shadowTsSourceMap = computed(() => {
		if (shadowTsTextDocument.value && sourceMap.value) {
			const newSourceMap = new TsSourceMap(
				sourceMap.value.sourceDocument,
				shadowTsTextDocument.value,
				sourceMap.value.isInterpolation,
				{ foldingRanges: false, formatting: false },
			);
			for (const maped of sourceMap.value) {
				newSourceMap.add({
					...maped,
					data: {
						...maped.data,
						capabilities: {},
					},
				})
			}
			return newSourceMap;
		}
	});

	return {
		genResult: scriptSetupGenResult,
		textDocument,
		sourceMap,
		mirrorsSourceMap,
		shadowTsTextDocument,
		shadowTsSourceMap,
	};
}

function genScriptSetup(
	uri: string,
	originalCode: string,
	setupParams: string,
	data: ReturnType<typeof getScriptSetupData>,
) {
	let sourceCode = originalCode;
	const mappings: {
		isNoDollarRef?: boolean,
		capabilities: TsMappingData['capabilities'],
		scriptSetupRange: MapedRange,
		genRange: MapedRange,
		mode: MapedMode,
	}[] = [];
	const mirrors: {
		left: MapedRange,
		right: MapedRange,
	}[] = [];
	let genCode = `\n/* <script setup> */\n`;
	if (rfc === '#182') {
		genCode += `import * as __VLS_exports from './${upath.basename(uri)}.scriptSetup.raw'\n`;
	}
	if (rfc === '#222') {
		let newLinesOnly = originalCode.split('\n').map(line => ' '.repeat(line.length)).join('\n');
		let importPos = 0;
		for (const _import of data.imports.sort((a, b) => a.start - b.start)) {
			addCode(newLinesOnly.substring(importPos, _import.start), { // for auto import
				capabilities: {},
				scriptSetupRange: {
					start: importPos,
					end: _import.start,
				},
				mode: MapedMode.Offset,
			});
			addCode(originalCode.substring(_import.start, _import.end), {
				capabilities: {
					basic: true,
					references: true,
					rename: true,
					semanticTokens: true,
					completion: true,
					diagnostic: true,
				},
				scriptSetupRange: {
					start: _import.start,
					end: _import.end,
				},
				mode: MapedMode.Offset,
			});
			sourceCode = replaceStringToEmpty(sourceCode, _import.start, _import.end);
			importPos = _import.end;
		}
		addCode(newLinesOnly.substring(importPos, newLinesOnly.length), { // for auto import
			capabilities: {},
			scriptSetupRange: {
				start: importPos,
				end: newLinesOnly.length,
			},
			mode: MapedMode.Offset,
		});
		for (const _export of data.exportKeywords) {
			sourceCode = replaceStringToEmpty(sourceCode, _export.start, _export.end);
		}
	}
	if (data.exportDefault) {
		sourceCode = replaceStringToEmpty(sourceCode, data.exportDefault.start, data.exportDefault.expression.start);
		sourceCode = replaceStringToEmpty(sourceCode, data.exportDefault.expression.end, data.exportDefault.end);
	}

	const declaresNames = new Set<string>();
	for (const d of data.declares) {
		let nameText = originalCode.substring(d.name.start, d.name.end);
		declaresNames.add(nameText);
		if (['props', 'emit', 'slots'].includes(nameText)) {
			addCode(originalCode.substring(d.start, d.name.start), {
				scriptSetupRange: {
					start: d.start,
					end: d.name.start,
				},
				mode: MapedMode.Offset,
				capabilities: {
					basic: true,
					references: true,
					diagnostic: true,
					rename: true,
					completion: true,
					semanticTokens: true,
				},
			});
			addCode('__VLS_declares_' + nameText, {
				scriptSetupRange: {
					start: d.name.start,
					end: d.name.end,
				},
				mode: MapedMode.Offset,
				capabilities: {
					basic: true,
					diagnostic: true,
					semanticTokens: true,
				},
			});
			addCode(originalCode.substring(d.name.end, d.end), {
				scriptSetupRange: {
					start: d.name.end,
					end: d.end,
				},
				mode: MapedMode.Offset,
				capabilities: {
					basic: true,
					references: true,
					diagnostic: true,
					rename: true,
					completion: true,
					semanticTokens: true,
				},
			});
		}
		else {
			addCode(originalCode.substring(d.start, d.end), {
				scriptSetupRange: {
					start: d.start,
					end: d.end,
				},
				mode: MapedMode.Offset,
				capabilities: {
					basic: true,
					references: true,
					diagnostic: true,
					rename: true,
					completion: true,
					semanticTokens: true,
				},
			});
		}
		genCode += `\n`;
		sourceCode = replaceStringToEmpty(sourceCode, d.start, d.end);
	}

	if (rfc === '#182') {
		addCode(sourceCode, {
			scriptSetupRange: {
				start: 0,
				end: sourceCode.length,
			},
			mode: MapedMode.Offset,
			capabilities: {
				basic: true,
				references: true,
				diagnostic: true,
				rename: true,
				completion: true,
				semanticTokens: true,
			},
		});
	}

	genCode += `\n`;
	genCode += `export default (await import('@vue/runtime-dom')).defineComponent({\n`;
	if (declaresNames.has('props')) {
		genCode += `props: ({} as __VLS_DefinePropsToOptions<typeof __VLS_declares_props>),\n`;
	}
	if (data.defineProps?.typeArgs) {
		genCode += `props: ({} as __VLS_DefinePropsToOptions<`
		addCode(originalCode.substring(data.defineProps.typeArgs.start, data.defineProps.typeArgs.end), {
			capabilities: {},
			scriptSetupRange: {
				start: data.defineProps.typeArgs.start,
				end: data.defineProps.typeArgs.end,
			},
			mode: MapedMode.Offset,
		});
		genCode += `>),\n`;
	}
	// TODO: emit types
	if (data.exportDefault) {
		genCode += `...(`;
		addCode(originalCode.substring(data.exportDefault.args.start, data.exportDefault.args.end), {
			capabilities: {
				basic: true,
				references: true,
				diagnostic: true,
				rename: true,
				completion: true,
				semanticTokens: true,
			},
			mode: MapedMode.Offset,
			scriptSetupRange: {
				start: data.exportDefault.args.start,
				end: data.exportDefault.args.end,
			},
		});
		genCode += `),\n`;
	}
	if (data.defineProps?.args) {
		genCode += `props: `;
		addCode(originalCode.substring(data.defineProps.args.start, data.defineProps.args.end), {
			capabilities: {
				basic: true,
				references: true,
				diagnostic: true,
				rename: true,
				completion: true,
				semanticTokens: true,
			},
			mode: MapedMode.Offset,
			scriptSetupRange: {
				start: data.defineProps.args.start,
				end: data.defineProps.args.end,
			},
		});
		genCode += `,\n`;
	}
	if (data.defineEmit?.args) {
		genCode += `emits: `;
		addCode(originalCode.substring(data.defineEmit.args.start, data.defineEmit.args.end), {
			capabilities: {
				basic: true,
				references: true,
				diagnostic: true,
				rename: true,
				completion: true,
				semanticTokens: true,
			},
			mode: MapedMode.Offset,
			scriptSetupRange: {
				start: data.defineEmit.args.start,
				end: data.defineEmit.args.end,
			},
		});
		genCode += `,\n`;
	}
	genCode += `async `;
	addCode('setup', {
		capabilities: {},
		mode: MapedMode.Gate,
		scriptSetupRange: {
			start: 0,
			end: 0,
		},
	});
	genCode += `(${setupParams}${SearchTexts.SetupParams}) {\n`;

	if (rfc === '#222') {
		const labels = data.labels.sort((a, b) => a.start - b.start);
		let tsOffset = 0;
		for (const label of labels) {
			mapSubText(tsOffset, label.start);
			let first = true;

			for (const binary of label.binarys) {
				if (first) {
					first = false;
					genCode += `const `;
				}
				else {
					genCode += `, `;
				}

				let leftPos = binary.left.start;
				for (const prop of binary.vars.sort((a, b) => a.start - b.start)) {
					const propText = prop.isShortand ? `${prop.text}: __VLS_refs_${prop.text}` : `__VLS_refs_${prop.text}`;
					genCode += originalCode.substring(leftPos, prop.start);
					addCode(propText, {
						isNoDollarRef: false,
						capabilities: {},
						scriptSetupRange: binary.left,
						mode: MapedMode.Offset, // TODO
					});
					leftPos = prop.end;
				}
				genCode += originalCode.substring(leftPos, binary.left.end);

				if (binary.right) {
					genCode += ` = `;
					mapSubText(binary.right.start, binary.right.end);
				}
			}
			genCode += `;\n`;

			for (const binary of label.binarys) {
				for (const prop of binary.vars) {
					genCode += `let `;
					const leftRange = {
						start: genCode.length,
						end: genCode.length + prop.text.length,
					};
					addCode(prop.text, {
						isNoDollarRef: true,
						capabilities: {
							basic: true, // hover
							references: true,
							rename: true,
							diagnostic: true,
						},
						scriptSetupRange: {
							start: prop.start,
							end: prop.end,
						},
						mode: MapedMode.Offset,
					});
					genCode += ` = (await import('@vue/reactivity')).unref(`;
					if (binary.right) {
						addCode(`__VLS_refs_${prop.text}`, {
							isNoDollarRef: false,
							capabilities: {},
							scriptSetupRange: binary.right,
							mode: MapedMode.Offset, // TODO
						});
					}
					else {
						genCode += `__VLS_refs_${prop.text}`;
					}
					genCode += `); ${prop.text}; // ignore unused\n`;

					genCode += `const `;
					const rightRange = {
						start: genCode.length,
						end: genCode.length + `$${prop.text}`.length,
					};
					addCode(`$${prop.text}`, {
						isNoDollarRef: true,
						capabilities: {
							diagnostic: true,
						},
						scriptSetupRange: {
							start: prop.start,
							end: prop.end,
						},
						mode: MapedMode.Offset, // TODO
					});
					genCode += ` = (await import('@vue/reactivity')).ref(`;
					if (binary.right) {
						addCode(`__VLS_refs_${prop.text}`, {
							isNoDollarRef: false,
							capabilities: {},
							scriptSetupRange: binary.right,
							mode: MapedMode.Offset, // TODO
						});
					}
					else {
						genCode += `__VLS_refs_${prop.text}`;
					}
					genCode += `);${prop.inRoot ? ` $${prop.text}; // ignore unused\n` : '\n'}`;
					mirrors.push({
						left: leftRange,
						right: rightRange,
					});
				}
			}

			tsOffset = label.end;
		}
		mapSubText(tsOffset, sourceCode.length);
	}

	genCode += `return {\n`;
	if (rfc === '#182') {
		genCode += `...__VLS_exports,\n`;
	}
	if (rfc === '#222') {
		for (const expose of data.exposeVarNames) {
			const varName = originalCode.substring(expose.start, expose.end);
			const leftRange = {
				start: genCode.length,
				end: genCode.length + varName.length,
			};
			// TODO: remove this
			addCode(varName, {
				capabilities: {},
				scriptSetupRange: {
					start: expose.start,
					end: expose.end,
				},
				mode: MapedMode.Offset,
			});
			genCode += ': ';
			const rightRange = {
				start: genCode.length,
				end: genCode.length + varName.length,
			};
			// TODO: remove this
			addCode(varName, {
				capabilities: {},
				scriptSetupRange: {
					start: expose.start,
					end: expose.end,
				},
				mode: MapedMode.Offset,
			});
			genCode += ', \n';
			mirrors.push({
				left: leftRange,
				right: rightRange,
			});
		}
		for (const label of data.labels) {
			for (const binary of label.binarys) {
				for (const refVar of binary.vars) {
					if (refVar.inRoot) {
						const leftRange = {
							start: genCode.length,
							end: genCode.length + refVar.text.length,
						};
						// TODO: remove this
						addCode(refVar.text, {
							isNoDollarRef: true,
							capabilities: {},
							scriptSetupRange: {
								start: refVar.start,
								end: refVar.end,
							},
							mode: MapedMode.Offset,
						});
						genCode += ': ';
						const rightRange = {
							start: genCode.length,
							end: genCode.length + refVar.text.length,
						};
						// TODO: remove this
						addCode(refVar.text, {
							isNoDollarRef: true,
							capabilities: {},
							scriptSetupRange: {
								start: refVar.start,
								end: refVar.end,
							},
							mode: MapedMode.Offset,
						});
						genCode += ', \n';
						mirrors.push({
							left: leftRange,
							right: rightRange,
						});
					}
				}
			}
		}
	}
	genCode += `};\n`
	genCode += `}});\n`;

	genCode += `\n// @ts-ignore\n`
	genCode += `ref${SearchTexts.Ref}\n`; // for execute auto import

	return {
		declaresNames,
		data,
		mappings,
		code: genCode,
		mirrors,
	};

	function mapSubText(start: number, end: number) {
		let insideLabels: {
			start: number,
			end: number,
			name: string,
			isRaw: boolean,
		}[] = [];
		for (const label of data.labels) {
			for (const binary of label.binarys) {
				for (const prop of binary.vars) {
					for (const reference of prop.references) {
						if (reference.start >= start && reference.end <= end) {
							insideLabels.push({
								start: reference.start,
								end: reference.end,
								name: prop.text,
								isRaw: false,
							});
						}
					}
				}
			}
		}
		insideLabels = insideLabels.sort((a, b) => a.start - b.start);

		let pos = start;
		for (const label of insideLabels) {
			writeStartText();
			writeCenter();

			function writeStartText() {
				const startText = sourceCode.substring(pos, label.start);
				addCode(startText, {
					capabilities: {
						basic: true,
						references: true,
						diagnostic: true,
						rename: true,
						completion: true,
						semanticTokens: true,
					},
					scriptSetupRange: {
						start: pos,
						end: pos + startText.length,
					},
					mode: MapedMode.Offset,
				});
			}
			function writeCenter() {
				let isShorthand = false;
				for (const shorthandProperty of data.shorthandPropertys) {
					if (
						label.start === shorthandProperty.start
						&& label.end === shorthandProperty.end
					) {
						isShorthand = true;
						break;
					}
				}
				if (isShorthand) {
					addCode(label.name, {
						capabilities: {
							diagnostic: true,
						},
						scriptSetupRange: {
							start: label.start,
							end: label.end,
						},
						mode: MapedMode.Offset,
					});
					genCode += ': ';
				}
				if (!label.isRaw) {
					addCode(`$${label.name}.value`, {
						capabilities: {
							diagnostic: true,
						},
						scriptSetupRange: {
							start: label.start,
							end: label.end,
						},
						mode: MapedMode.Gate,
					}, false);
					addCode(`$${label.name}`, {
						isNoDollarRef: true,
						capabilities: {
							basic: true, // hover, TODO: hover display type incorrect
							references: true,
							rename: true,
						},
						scriptSetupRange: {
							start: label.start,
							end: label.end,
						},
						mode: MapedMode.Offset,
					});
					genCode += `.`;
					addCode(`value`, {
						capabilities: {
							diagnostic: true,
						},
						scriptSetupRange: {
							start: label.start,
							end: label.end,
						},
						mode: MapedMode.Gate,
					});
				}
				else {
					addCode(`$${label.name}`, {
						capabilities: {
							basic: true, // hover
							references: true,
							rename: true,
						},
						scriptSetupRange: {
							start: label.start,
							end: label.end,
						},
						mode: MapedMode.Offset,
					});
				}
				pos = label.end;
			}
		}
		writeEndText();

		function writeEndText() {
			const endText = sourceCode.substring(pos, end);
			addCode(endText, {
				capabilities: {
					basic: true,
					references: true,
					diagnostic: true,
					rename: true,
					completion: true,
					semanticTokens: true,
				},
				scriptSetupRange: {
					start: pos,
					end: pos + endText.length,
				},
				mode: MapedMode.Offset,
			});
		}
	}
	function addCode(code: string, mapping: {
		isNoDollarRef?: boolean,
		capabilities: TsMappingData['capabilities'],
		scriptSetupRange: MapedRange,
		mode: MapedMode,
	}, write = true) {
		mappings.push({
			...mapping,
			genRange: {
				start: genCode.length,
				end: genCode.length + code.length,
			},
		});
		if (write) {
			genCode += code;
		}
	}
}
function getScriptSetupData(sourceCode: string) {
	const labels: {
		start: number,
		end: number,
		binarys: {
			parent: {
				start: number,
				end: number,
			},
			vars: {
				isShortand: boolean,
				inRoot: boolean,
				text: string,
				start: number,
				end: number,
				references: {
					start: number,
					end: number,
				}[],
			}[],
			left: {
				start: number,
				end: number,
			},
			right?: {
				start: number,
				end: number,
				isComputedCall: boolean,
			},
		}[],
		label: {
			start: number,
			end: number,
		},
		parent: {
			start: number,
			end: number,
		},
	}[] = [];
	const exposeVarNames: {
		start: number,
		end: number,
	}[] = [];
	const imports: {
		start: number,
		end: number,
	}[] = [];
	const exportKeywords: {
		start: number,
		end: number,
	}[] = [];
	let exportDefault: {
		start: number,
		end: number,
		expression: {
			start: number,
			end: number,
		},
		args: {
			text: string,
			start: number,
			end: number,
		},
	} | undefined;
	let defineProps: {
		start: number,
		end: number,
		args?: {
			start: number,
			end: number,
		},
		typeArgs?: {
			start: number,
			end: number,
		},
	} | undefined;
	let defineEmit: typeof defineProps;
	const declares: {
		start: number,
		end: number,
		name: {
			start: number,
			end: number,
		},
	}[] = [];
	const refCalls: {
		start: number,
		end: number,
		vars: {
			start: number,
			end: number,
		}[],
		left: {
			start: number,
			end: number,
		},
		rightExpression: {
			start: number,
			end: number,
		},
	}[] = [];
	const shorthandPropertys: {
		start: number,
		end: number,
	}[] = [];

	const scriptAst = ts.createSourceFile('', sourceCode, ts.ScriptTarget.Latest);
	scriptAst.forEachChild(node => {
		if (node.modifiers?.find(m => m.kind === ts.SyntaxKind.DeclareKeyword)) {
			if (ts.isVariableStatement(node)) {
				for (const declaration of node.declarationList.declarations) {
					if (ts.isIdentifier(declaration.name)) {
						declares.push({
							start: node.getStart(scriptAst),
							end: node.getStart(scriptAst) + node.getWidth(scriptAst),
							name: {
								start: declaration.name.getStart(scriptAst),
								end: declaration.name.getStart(scriptAst) + declaration.name.getWidth(scriptAst),
							},
						});
					}
				}
			}
			else if (ts.isFunctionDeclaration(node)) {
				if (node.name) {
					declares.push({
						start: node.getStart(scriptAst),
						end: node.getStart(scriptAst) + node.getWidth(scriptAst),
						name: {
							start: node.name.getStart(scriptAst),
							end: node.name.getStart(scriptAst) + node.name.getWidth(scriptAst),
						},
					});
				}
			}
		}
		else if (ts.isVariableStatement(node)) {
			for (const node_2 of node.declarationList.declarations) {
				const vars = findBindingVars(node_2.name);
				for (const _var of vars) {
					exposeVarNames.push(_var);
				}
			}
		}
		else if (ts.isFunctionDeclaration(node)) {
			if (node.name && ts.isIdentifier(node.name)) {
				exposeVarNames.push({
					start: node.name.getStart(scriptAst),
					end: node.name.getStart(scriptAst) + node.name.getWidth(scriptAst),
				});
			}
		}
		else if (ts.isImportDeclaration(node)) {
			imports.push({
				start: node.getStart(scriptAst),
				end: node.getStart(scriptAst) + node.getWidth(scriptAst),
			});
			if (node.importClause && !node.importClause.isTypeOnly) {
				if (node.importClause.name) {
					exposeVarNames.push({
						start: node.importClause.name.getStart(scriptAst),
						end: node.importClause.name.getStart(scriptAst) + node.importClause.name.getWidth(scriptAst),
					});
				}
				if (node.importClause.namedBindings && ts.isNamedImports(node.importClause.namedBindings)) {
					for (const element of node.importClause.namedBindings.elements) {
						exposeVarNames.push({
							start: element.name.getStart(scriptAst),
							end: element.name.getStart(scriptAst) + element.name.getWidth(scriptAst),
						});
					}
				}
			}
		}
		else if (ts.isExportDeclaration(node)) {
			node.forEachChild(node_2 => {
				if (node_2.kind === ts.SyntaxKind.ExportKeyword) {
					exportKeywords.push({
						start: node_2.getStart(scriptAst),
						end: node_2.getStart(scriptAst) + node_2.getWidth(scriptAst),
					});
				}
			});
		}
		else if (ts.isExportAssignment(node)) {
			let obj: ts.ObjectLiteralExpression | undefined;
			if (ts.isObjectLiteralExpression(node.expression)) {
				obj = node.expression;
			}
			else if (ts.isCallExpression(node.expression) && node.expression.arguments.length) {
				const arg0 = node.expression.arguments[0];
				if (ts.isObjectLiteralExpression(arg0)) {
					obj = arg0;
				}
			}
			if (obj) {
				exportDefault = {
					start: node.getStart(scriptAst),
					end: node.getStart(scriptAst) + node.getWidth(scriptAst),
					expression: {
						start: node.expression.getStart(scriptAst),
						end: node.expression.getStart(scriptAst) + node.expression.getWidth(scriptAst),
					},
					args: {
						text: obj.getText(scriptAst),
						start: obj.getStart(scriptAst),
						end: obj.getStart(scriptAst) + obj.getWidth(scriptAst),
					},
				};
			}
		}
	});
	scriptAst.forEachChild(node => {
		deepLoop(node, scriptAst, true);
	});

	let noLabelCode = sourceCode;
	for (const label of labels) {
		noLabelCode = noLabelCode.substring(0, label.label.start) + 'let' + noLabelCode.substring(label.label.end).replace(':', ' ');
		for (const binary of label.binarys) {
			if (binary.parent.start !== binary.left.start) {
				noLabelCode = replaceStringToEmpty(noLabelCode, binary.parent.start, binary.left.start);
			}
			if (binary.parent.end !== binary.left.end) {
				noLabelCode = replaceStringToEmpty(noLabelCode, (binary.right ?? binary.left).end, binary.parent.end);
			}
		}
	}
	const cheapTs = getCheapTsService(noLabelCode);
	for (const label of labels) {
		for (const binary of label.binarys) {
			for (const _var of binary.vars) {
				const references = cheapTs.service.findReferences(cheapTs.scriptName, _var.start);
				if (references) {
					for (const reference of references) {
						for (const reference_2 of reference.references) {
							if ( // remove definition
								reference_2.textSpan.start === _var.start
								&& reference_2.textSpan.start + reference_2.textSpan.length === _var.end
							) continue;
							_var.references.push({
								start: reference_2.textSpan.start,
								end: reference_2.textSpan.start + reference_2.textSpan.length,
							});
						}
					}
				}
			}
		}
	}

	return {
		labels,
		exposeVarNames,
		imports,
		exportKeywords,
		exportDefault,
		defineProps,
		defineEmit,
		declares,
		refCalls,
		shorthandPropertys,
	};

	function deepLoop(node: ts.Node, parent: ts.Node, inRoot: boolean) {
		if (
			ts.isLabeledStatement(node)
			&& node.label.getText(scriptAst) === 'ref'
			&& ts.isExpressionStatement(node.statement)
		) {
			labels.push({
				start: node.getStart(scriptAst),
				end: node.getStart(scriptAst) + node.getWidth(scriptAst),
				label: {
					start: node.label.getStart(scriptAst),
					end: node.label.getStart(scriptAst) + node.label.getWidth(scriptAst),
				},
				parent: {
					start: parent.getStart(scriptAst),
					end: parent.getStart(scriptAst) + parent.getWidth(scriptAst),
				},
				binarys: findBinaryExpressions(node.statement.expression, inRoot),
			});
		}
		else if (
			ts.isCallExpression(node)
			&& ts.isIdentifier(node.expression)
			&& (
				node.expression.getText(scriptAst) === 'defineProps'
				|| node.expression.getText(scriptAst) === 'defineEmit'
			)
		) {
			// TODO: handle this
			// import * as vue from 'vue'
			// const props = vue.defineProps...
			const arg: ts.Expression | undefined = node.arguments.length ? node.arguments[0] : undefined;
			const typeArg: ts.TypeNode | undefined = node.typeArguments?.length ? node.typeArguments[0] : undefined;
			const call = {
				start: node.getStart(scriptAst),
				end: node.getStart(scriptAst) + node.getWidth(scriptAst),
				args: arg ? {
					start: arg.getStart(scriptAst),
					end: arg.getStart(scriptAst) + arg.getWidth(scriptAst),
				} : undefined,
				typeArgs: typeArg ? {
					start: typeArg.getStart(scriptAst),
					end: typeArg.getStart(scriptAst) + typeArg.getWidth(scriptAst),
				} : undefined,
			};
			if (node.expression.getText(scriptAst) === 'defineProps') {
				defineProps = call;
			}
			else if (node.expression.getText(scriptAst) === 'defineEmit') {
				defineEmit = call;
			}
		}
		else if (
			ts.isVariableDeclarationList(node)
			&& node.declarations.length === 1
			&& node.declarations[0].initializer
			&& ts.isCallExpression(node.declarations[0].initializer)
			&& ts.isIdentifier(node.declarations[0].initializer.expression)
			&& ['ref', 'computed'].includes(node.declarations[0].initializer.expression.getText(scriptAst))
		) {
			const declaration = node.declarations[0];
			const refCall = node.declarations[0].initializer;
			const isRef = refCall.expression.getText(scriptAst) === 'ref';
			const wrapContant = isRef && refCall.arguments.length === 1 ? refCall.arguments[0] : refCall;
			refCalls.push({
				start: node.getStart(scriptAst),
				end: node.getStart(scriptAst) + node.getWidth(scriptAst),
				vars: findBindingVars(declaration.name),
				left: {
					start: declaration.name.getStart(scriptAst),
					end: declaration.name.getStart(scriptAst) + declaration.name.getWidth(scriptAst),
				},
				rightExpression: {
					// TODO: computed
					start: wrapContant.getStart(scriptAst),
					end: wrapContant.getStart(scriptAst) + wrapContant.getWidth(scriptAst),
				},
			});
		}
		else if (ts.isShorthandPropertyAssignment(node)) {
			shorthandPropertys.push({
				start: node.getStart(scriptAst),
				end: node.getStart(scriptAst) + node.getWidth(scriptAst),
			});
		}
		node.forEachChild(child => deepLoop(child, node, false));
	}
	function findBinaryExpressions(exp: ts.Expression, inRoot: boolean) {
		const binaryExps: typeof labels[0]['binarys'] = [];
		worker(exp);
		return binaryExps;
		function worker(node: ts.Expression, parenthesized?: ts.ParenthesizedExpression) {
			if (ts.isIdentifier(node)) {
				binaryExps.push({
					vars: findLabelVars(node, inRoot),
					left: {
						start: node.getStart(scriptAst),
						end: node.getStart(scriptAst) + node.getWidth(scriptAst),
					},
					parent: {
						start: node.getStart(scriptAst),
						end: node.getStart(scriptAst) + node.getWidth(scriptAst),
					},
				});
			}
			if (ts.isBinaryExpression(node)) {
				if (ts.isBinaryExpression(node.left) || ts.isBinaryExpression(node.right) || ts.isParenthesizedExpression(node.left) || ts.isParenthesizedExpression(node.right)) {
					worker(node.left);
					worker(node.right);
				}
				else {
					let parent: ts.Node = parenthesized ?? node;
					binaryExps.push({
						vars: findLabelVars(node.left, inRoot),
						left: {
							start: node.left.getStart(scriptAst),
							end: node.left.getStart(scriptAst) + node.left.getWidth(scriptAst),
						},
						right: {
							start: node.right.getStart(scriptAst),
							end: node.right.getStart(scriptAst) + node.right.getWidth(scriptAst),
							isComputedCall: ts.isCallExpression(node.right) && ts.isIdentifier(node.right.expression) && node.right.expression.getText(scriptAst) === 'computed'
						},
						parent: {
							start: parent.getStart(scriptAst),
							end: parent.getStart(scriptAst) + parent.getWidth(scriptAst),
						},
					});
				}
			}
			else if (ts.isParenthesizedExpression(node)) {
				// unwrap (...)
				worker(node.expression, parenthesized ?? node);
			}
		}
	}
	function findLabelVars(exp: ts.Expression, inRoot: boolean) {
		const vars: typeof labels[0]['binarys'][0]['vars'] = [];
		worker(exp);
		return vars;
		function worker(_node: ts.Node) {
			if (ts.isIdentifier(_node)) {
				vars.push({
					isShortand: false,
					inRoot,
					text: _node.getText(scriptAst),
					start: _node.getStart(scriptAst),
					end: _node.getStart(scriptAst) + _node.getWidth(scriptAst),
					references: [],
				});
			}
			// { ? } = ...
			else if (ts.isObjectLiteralExpression(_node)) {
				for (const property of _node.properties) {
					worker(property);
				}
			}
			// [ ? ] = ...
			else if (ts.isArrayLiteralExpression(_node)) {
				for (const property of _node.elements) {
					worker(property);
				}
			}
			// { foo: ? } = ...
			else if (ts.isPropertyAssignment(_node)) {
				worker(_node.initializer);
			}
			// { e: f = 2 } = ...
			else if (ts.isBinaryExpression(_node) && ts.isIdentifier(_node.left)) {
				worker(_node.left);
			}
			// { foo } = ...
			else if (ts.isShorthandPropertyAssignment(_node)) {
				vars.push({
					isShortand: true,
					inRoot,
					text: _node.name.getText(scriptAst),
					start: _node.name.getStart(scriptAst),
					end: _node.name.getStart(scriptAst) + _node.name.getWidth(scriptAst),
					references: [],
				});
			}
			// { ...? } = ...
			// [ ...? ] = ...
			else if (ts.isSpreadAssignment(_node) || ts.isSpreadElement(_node)) {
				worker(_node.expression);
			}
		}
	}
	function findBindingVars(left: ts.BindingName) {
		const vars: MapedRange[] = [];
		worker(left);
		return vars;
		function worker(_node: ts.Node) {
			if (ts.isIdentifier(_node)) {
				vars.push({
					start: _node.getStart(scriptAst),
					end: _node.getStart(scriptAst) + _node.getWidth(scriptAst),
				});
			}
			// { ? } = ...
			// [ ? ] = ...
			else if (ts.isObjectBindingPattern(_node) || ts.isArrayBindingPattern(_node)) {
				for (const property of _node.elements) {
					if (ts.isBindingElement(property)) {
						worker(property.name);
					}
				}
			}
			// { foo: ? } = ...
			else if (ts.isPropertyAssignment(_node)) {
				worker(_node.initializer);
			}
			// { foo } = ...
			else if (ts.isShorthandPropertyAssignment(_node)) {
				vars.push({
					start: _node.name.getStart(scriptAst),
					end: _node.name.getStart(scriptAst) + _node.name.getWidth(scriptAst),
				});
			}
			// { ...? } = ...
			// [ ...? ] = ...
			else if (ts.isSpreadAssignment(_node) || ts.isSpreadElement(_node)) {
				worker(_node.expression);
			}
		}
	}
}
function getScriptData(sourceCode: string) {
	let exportDefault: {
		start: number,
		end: number,
		args: {
			text: string,
			start: number,
			end: number,
		},
	} | undefined;

	const scriptAst = ts.createSourceFile('', sourceCode, ts.ScriptTarget.Latest);
	scriptAst.forEachChild(node => {
		if (ts.isExportAssignment(node)) {
			let obj: ts.ObjectLiteralExpression | undefined;
			if (ts.isObjectLiteralExpression(node.expression)) {
				obj = node.expression;
			}
			else if (ts.isCallExpression(node.expression) && node.expression.arguments.length) {
				const arg0 = node.expression.arguments[0];
				if (ts.isObjectLiteralExpression(arg0)) {
					obj = arg0;
				}
			}
			if (obj) {
				exportDefault = {
					start: node.getStart(scriptAst),
					end: node.getStart(scriptAst) + node.getWidth(scriptAst),
					args: {
						text: obj.getText(scriptAst),
						start: obj.getStart(scriptAst),
						end: obj.getStart(scriptAst) + obj.getWidth(scriptAst),
					},
				};
			}
		}
	});

	return {
		exportDefault,
	};
}
function replaceStringToEmpty(str: string, start: number, end: number) {
	return str.substring(0, start) + ' '.repeat(end - start) + str.substring(end);
}
