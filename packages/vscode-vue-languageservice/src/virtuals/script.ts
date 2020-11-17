import { TextDocument } from 'vscode-languageserver-textdocument';
import { syntaxToLanguageId, getValidScriptSyntax } from '@volar/shared';
import { computed, Ref } from '@vue/reactivity';
import { IDescriptor } from '../types';
import { MapedMode, TsSourceMap, TsMappingData, MapedRange, SourceMap } from '../utils/sourceMaps';
import * as ts from 'typescript';
import { SearchTexts } from './common';
import * as upath from 'upath';

export let rfc: '#182' | '#222' = '#182';
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
	const optionsVueRanges = computed(() => {
		if (scriptSetup.value) {
			const data = scriptSetupData.value;
			if (data) {
				const result: MapedRange[] = [];
				for (const optionsNode of [...data.defineOptionsCalls, ...(data.exportDefault ? [data.exportDefault] : [])]) {
					result.push({
						start: scriptSetup.value.loc.start + optionsNode.options.start,
						end: scriptSetup.value.loc.start + optionsNode.options.end,
					})
				}
				return result;
			}
		}
		else if (script.value) {
			if (scriptData.value?.exportDefault) {
				return [{
					start: script.value.loc.start + scriptData.value.exportDefault.options.start,
					end: script.value.loc.start + scriptData.value.exportDefault.options.end,
				}];
			}
		}
		return [];
	});
	const scriptSetupGenResult = computed(() => {
		if (scriptSetup.value && scriptSetupData.value) {
			const vueDoc = getUnreactiveDoc();
			return genScriptSetup(vueDoc.uri, scriptSetup.value.content, scriptSetup.value.setup, scriptSetupData.value);
		}
	});
	const textDocument = computed(() => {
		if (!script.value && !scriptSetup.value) return;

		const vueDoc = getUnreactiveDoc();
		const lang = getValidScriptSyntax(scriptSetup.value?.lang ?? script.value?.lang ?? 'js');
		const uri = `${vueDoc.uri}.script.${lang}`;
		let code = '';

		if (script.value) {
			code += script.value.content;
		}
		if (scriptSetupGenResult.value) {
			code += scriptSetupGenResult.value.code;
		}
		for (let i = 0; i < optionsVueRanges.value.length; i++) {
			const optionsVueRange = optionsVueRanges.value[i];
			code += `\nconst __VLS_options_${i} = ` + vueDoc.getText().substring(optionsVueRange.start, optionsVueRange.end);
		}
		code += `\nexport declare const __VLS_options: {}`;
		for (let i = 0; i < optionsVueRanges.value.length; i++) {
			code += ` & typeof __VLS_options_${i}`;
		}

		return TextDocument.create(uri, syntaxToLanguageId(lang), version++, code);
	});
	const sourceMap = computed(() => {
		if (!script.value && !scriptSetup.value) return;
		if (!textDocument.value) return;

		const vueDoc = getUnreactiveDoc();
		const sourceMap = new TsSourceMap(vueDoc, textDocument.value, false, { foldingRanges: true, formatting: true });
		let pos = 0;

		if (script.value) {
			const start = script.value.loc.start;
			const end = script.value.loc.end;
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
					start: start,
					end: end,
				},
				targetRange: {
					start: 0,
					end: end - start,
				},
			});
			pos += script.value.content.length;
		}
		if (scriptSetup.value && scriptSetupGenResult.value) {
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
						start: pos + mapping.genRange.start,
						end: pos + mapping.genRange.end,
					},
				});
			}
			{
				const setup = scriptSetup.value.setup;
				const start = vueDoc.getText().substring(0, scriptSetup.value.loc.start).lastIndexOf(setup); // TODO: don't use indexOf()
				const end = start + setup.length;
				const start_2 = textDocument.value.getText().lastIndexOf(`${setup}${SearchTexts.SetupParams}`);
				const end_2 = start_2 + setup.length;
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
						start: start,
						end: end,
					},
					targetRange: {
						start: start_2,
						end: end_2,
					},
				});
			}
			pos += scriptSetupGenResult.value.code.length;
		}
		for (let i = 0; i < optionsVueRanges.value.length; i++) {
			const optionsVueRange = optionsVueRanges.value[i];
			pos += `\nconst __VLS_options_${i} = `.length;
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
				targetRange: {
					start: pos,
					end: pos + optionsVueRange.end - optionsVueRange.start,
				},
			});
			pos += optionsVueRange.end - optionsVueRange.start;
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

	return {
		genResult: scriptSetupGenResult,
		textDocument,
		sourceMap,
		mirrorsSourceMap,
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
		sourceCode = replaceStringToEmpty(sourceCode, data.exportDefault.start, data.exportDefault.end);
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
	genCode += `// @ts-ignore\n`;
	genCode += `const __VLS_exportComponent = (await import('@vue/runtime-dom')).defineComponent({\n`;
	for (const optionsNode of [...data.defineOptionsCalls, ...(data.exportDefault ? [data.exportDefault] : [])]) {
		genCode += `...(`;
		addCode(originalCode.substring(optionsNode.options.start, optionsNode.options.end), {
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
				start: optionsNode.options.start,
				end: optionsNode.options.end,
			},
		});
		genCode += `),\n`;
	}
	genCode += `async setup() {\n`;

	if (rfc === '#222') {
		const labels = data.labels.sort((a, b) => a.start - b.start);
		let tsOffset = 0;
		for (const label of labels) {
			mapSubText(tsOffset, label.start);
			genCode += `const `;

			let left = '';
			let leftPos = label.left.start;
			for (const prop of label.vars.sort((a, b) => a.start - b.start)) {
				const propText = prop.isShortand ? `${prop.text}: __VLS_refs_${prop.text}` : `__VLS_refs_${prop.text}`;
				left += originalCode.substring(leftPos, prop.start);
				left += propText;
				leftPos = prop.end;
			}
			left += originalCode.substring(leftPos, label.left.end);

			genCode += `${left} = `;
			mapSubText(label.right.start, label.right.end);
			genCode += `;\n`;

			for (const prop of label.vars) {
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
				genCode += ` = (await import('@vue/runtime-dom')).unref(__VLS_refs_${prop.text});`;
				genCode += ` ${prop.text}; // ignore unused\n`

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
				genCode += ` = (await import('@vue/runtime-dom')).ref(__VLS_refs_${prop.text});${prop.inRoot ? `$${prop.text}; // ignore unused\n` : ''}\n`;
				mirrors.push({
					left: leftRange,
					right: rightRange,
				});
			}

			tsOffset = label.end;
		}
		mapSubText(tsOffset, sourceCode.length);
	}

	genCode += `return {\n`;
	if (declaresNames.has('props')) {
		genCode += `...__VLS_declares_props,\n`;
	}
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
		for (const ref of data.labels) {
			for (const refVar of ref.vars) {
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
	genCode += `};\n`
	genCode += `}});\n`;

	genCode += `declare const __VLS_export: new (...args: any) => InstanceType<typeof __VLS_exportComponent>`;
	const addedDeclares = new Set<string>();
	for (const d of data.declares) {
		let nameText = originalCode.substring(d.name.start, d.name.end);
		if (addedDeclares.has(nameText)) continue;
		addedDeclares.add(nameText);
		if (['props', 'emit'].includes(nameText)) {
			genCode += ` & { $${nameText}: typeof __VLS_declares_${nameText} }`
		}
	}
	genCode += `;\n`;
	genCode += `export default __VLS_export;\n`;

	genCode += `// @ts-ignore\n`;
	genCode += `const __VLS_component = (await import('@vue/runtime-dom')).defineComponent({\n`;
	for (const optionsNode of [...data.defineOptionsCalls, ...(data.exportDefault ? [data.exportDefault] : [])]) {
		genCode += `...(`;
		addCode(originalCode.substring(optionsNode.options.start, optionsNode.options.end), {
			capabilities: {
				references: true,
				rename: true,
			},
			mode: MapedMode.Offset,
			scriptSetupRange: {
				start: optionsNode.options.start,
				end: optionsNode.options.end,
			},
		});
		genCode += `),\n`;
	}
	genCode += `});\n`;
	genCode += `declare var [${setupParams}${SearchTexts.SetupParams}]: Parameters<NonNullable<typeof __VLS_component.setup>> & [
		${declaresNames.has('props') ? 'typeof __VLS_declares_props' : '{}'},
		{
			${declaresNames.has('emit') ? 'emit: typeof __VLS_declares_emit,' : ''}
			${declaresNames.has('slots') ? 'slots: typeof __VLS_declares_slots,' : ''}
		}
	]`;

	genCode += `\n// @ts-ignore`
	genCode += `\nref${SearchTexts.Ref}`; // for execute auto import

	return {
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
			for (const prop of label.vars) {
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
		insideLabels = insideLabels.sort((a, b) => a.start - b.start);

		let pos = start;
		for (const split of insideLabels) {
			writeStartText();
			writeCenter();

			function writeStartText() {
				const startText = sourceCode.substring(pos, split.start);
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
				if (!split.isRaw) {
					addCode(`$${split.name}`, {
						isNoDollarRef: true,
						capabilities: {
							basic: true, // hover, TODO: hover display type incorrect
							references: true,
							rename: true,
						},
						scriptSetupRange: {
							start: split.start,
							end: split.end,
						},
						mode: MapedMode.Offset,
					});
					genCode += `.`;
					addCode(`value`, {
						capabilities: {
							diagnostic: true,
						},
						scriptSetupRange: {
							start: split.start,
							end: split.end,
						},
						mode: MapedMode.Gate,
					});
				}
				else {
					addCode(`$${split.name}`, {
						capabilities: {
							basic: true, // hover
							references: true,
							rename: true,
						},
						scriptSetupRange: {
							start: split.start,
							end: split.end,
						},
						mode: MapedMode.Offset,
					});
				}
				pos = split.end;
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
	}) {
		mappings.push({
			...mapping,
			genRange: {
				start: genCode.length,
				end: genCode.length + code.length,
			},
		});
		genCode += code;
	}
}
function getScriptSetupData(sourceCode: string) {
	const labels: {
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
		start: number,
		end: number,
		label: {
			start: number,
			end: number,
		},
		parent: {
			start: number,
			end: number,
		},
		left: {
			start: number,
			end: number,
		},
		right: {
			start: number,
			end: number,
			isComputedCall: boolean,
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
		options: {
			start: number,
			end: number,
		},
	} | undefined;
	const defineOptionsCalls: {
		start: number,
		end: number,
		options: {
			start: number,
			end: number,
		},
	}[] = [];
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

	const scriptAst = ts.createSourceFile('', sourceCode, ts.ScriptTarget.Latest);
	let hasImportDefineOptions = false;
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
				if (ts.isIdentifier(node_2.name)) {
					exposeVarNames.push({
						start: node_2.name.getStart(scriptAst),
						end: node_2.name.getStart(scriptAst) + node_2.name.getWidth(scriptAst),
					});
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
			if (node.importClause?.name) {
				exposeVarNames.push({
					start: node.importClause.name.getStart(scriptAst),
					end: node.importClause.name.getStart(scriptAst) + node.importClause.name.getWidth(scriptAst),
				});
			}
			if (node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings)) {
				for (const element of node.importClause.namedBindings.elements) {
					exposeVarNames.push({
						start: element.name.getStart(scriptAst),
						end: element.name.getStart(scriptAst) + element.name.getWidth(scriptAst),
					});
					if (element.name.getText(scriptAst) === 'defineOptions') {
						hasImportDefineOptions = true;
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
					options: {
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
	}
	setFindReferencesSource(noLabelCode);
	for (const label of labels) {
		for (const _var of label.vars) {
			const references = findReferences(_var.start);
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

	return {
		labels,
		exposeVarNames,
		imports,
		exportKeywords,
		exportDefault,
		defineOptionsCalls,
		declares,
		refCalls,
	};

	function deepLoop(node: ts.Node, parent: ts.Node, inRoot: boolean) {
		if (
			ts.isLabeledStatement(node)
			&& node.label.getText(scriptAst) === 'ref'
			&& ts.isExpressionStatement(node.statement)
		) {
			let binaryExp = findBinaryExpression(node.statement.expression);
			const vars: {
				isShortand: boolean,
				inRoot: boolean,
				text: string,
				start: number,
				end: number,
				references: {
					start: number,
					end: number,
				}[],
			}[] = [];

			if (binaryExp) {
				if (ts.isIdentifier(binaryExp.left)) {
					vars.push({
						isShortand: false,
						inRoot,
						text: binaryExp.left.getText(scriptAst),
						start: binaryExp.left.getStart(scriptAst),
						end: binaryExp.left.getStart(scriptAst) + binaryExp.left.getWidth(scriptAst),
						references: [],
					});
				}
				else if (ts.isObjectLiteralExpression(binaryExp.left)) {
					for (const property of binaryExp.left.properties) {
						propertyWalker(property);
					}
				}
				else if (ts.isArrayLiteralExpression(binaryExp.left)) {
					for (const property of binaryExp.left.elements) {
						propertyWalker(property);
					}
				}

				labels.push({
					start: node.getStart(scriptAst),
					end: node.getStart(scriptAst) + node.getWidth(scriptAst),
					vars,
					label: {
						start: node.label.getStart(scriptAst),
						end: node.label.getStart(scriptAst) + node.label.getWidth(scriptAst),
					},
					parent: {
						start: parent.getStart(scriptAst),
						end: parent.getStart(scriptAst) + parent.getWidth(scriptAst),
					},
					left: {
						start: binaryExp.left.getStart(scriptAst),
						end: binaryExp.left.getStart(scriptAst) + binaryExp.left.getWidth(scriptAst),
					},
					right: {
						start: binaryExp.right.getStart(scriptAst),
						end: binaryExp.right.getStart(scriptAst) + binaryExp.right.getWidth(scriptAst),
						isComputedCall: ts.isCallExpression(binaryExp.right) && ts.isIdentifier(binaryExp.right.expression) && binaryExp.right.expression.getText(scriptAst) === 'computed',
					},
				});
			}

			function findBinaryExpression(node: ts.Expression): ts.BinaryExpression | undefined {
				if (ts.isBinaryExpression(node)) {
					return node;
				}
				else if (ts.isParenthesizedExpression(node)) {
					// unwrap (...)
					return findBinaryExpression(node.expression);
				}
			}
			function propertyWalker(property: ts.Node) {
				// { foo } = ...
				if (ts.isShorthandPropertyAssignment(property)) {
					vars.push({
						isShortand: true,
						inRoot,
						text: property.name.getText(scriptAst),
						start: property.name.getStart(scriptAst),
						end: property.name.getStart(scriptAst) + property.name.getWidth(scriptAst),
						references: [],
					});
				}
				// { foo: foo2 } = ...
				else if (ts.isPropertyAssignment(property) && ts.isIdentifier(property.initializer)) {
					vars.push({
						isShortand: false,
						inRoot,
						text: property.initializer.getText(scriptAst),
						start: property.initializer.getStart(scriptAst),
						end: property.initializer.getStart(scriptAst) + property.initializer.getWidth(scriptAst),
						references: [],
					});
				}
				// { ...rest } = ...
				else if (ts.isSpreadAssignment(property) && ts.isIdentifier(property.expression)) {
					vars.push({
						isShortand: false,
						inRoot,
						text: property.expression.getText(scriptAst),
						start: property.expression.getStart(scriptAst),
						end: property.expression.getStart(scriptAst) + property.expression.getWidth(scriptAst),
						references: [],
					});
				}
				// { foo: { ... } } = ...
				else if (ts.isPropertyAssignment(property) && ts.isObjectLiteralExpression(property.initializer)) {
					for (const property_2 of property.initializer.properties) {
						propertyWalker(property_2);
					}
				}
				// [foo] = ...
				else if (ts.isIdentifier(property)) {
					vars.push({
						isShortand: false,
						inRoot,
						text: property.getText(scriptAst),
						start: property.getStart(scriptAst),
						end: property.getStart(scriptAst) + property.getWidth(scriptAst),
						references: [],
					});
				}
			}
		}
		else if (
			hasImportDefineOptions
			&& ts.isCallExpression(node)
			&& ts.isIdentifier(node.expression)
			&& node.expression.getText(scriptAst) === 'defineOptions'
		) {
			// TODO: handle this
			// import * as vue from 'vue'
			// const { props } = vue.useProps(...)
			for (const arg of node.arguments) {
				defineOptionsCalls.push({
					start: node.getStart(scriptAst),
					end: node.getStart(scriptAst) + node.getWidth(scriptAst),
					options: {
						start: arg.getStart(scriptAst),
						end: arg.getStart(scriptAst) + arg.getWidth(scriptAst),
					},
				});
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
			const vars: typeof refCalls[0]['vars'] = [];
			if (ts.isObjectBindingPattern(declaration.name) || ts.isArrayBindingPattern(declaration.name)) {
				for (const element of declaration.name.elements) {
					vars.push({
						start: element.getStart(scriptAst),
						end: element.getStart(scriptAst) + element.getWidth(scriptAst),
					});
				}
			}
			else if (ts.isIdentifier(declaration.name)) {
				vars.push({
					start: declaration.name.getStart(scriptAst),
					end: declaration.name.getStart(scriptAst) + declaration.name.getWidth(scriptAst),
				});
			}
			refCalls.push({
				start: node.getStart(scriptAst),
				end: node.getStart(scriptAst) + node.getWidth(scriptAst),
				vars,
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
		node.forEachChild(child => deepLoop(child, node, false));
	}
}
function getScriptData(sourceCode: string) {
	let exportDefault: {
		start: number,
		end: number,
		options: {
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
					options: {
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

let fakeVersion = 0;
let fakeScript = ts.ScriptSnapshot.fromString('');
const fakeLs = ts.createLanguageService({
	getCompilationSettings: () => ({}),
	getScriptFileNames: () => ['fake.ts'],
	getScriptVersion: () => fakeVersion.toString(),
	getScriptSnapshot: () => fakeScript,
	getCurrentDirectory: () => '',
	getDefaultLibFileName: () => '',
});
function setFindReferencesSource(code: string) {
	fakeVersion++;
	fakeScript = ts.ScriptSnapshot.fromString(code);
}
function findReferences(offset: number) {
	return fakeLs.findReferences('fake.ts', offset);
}
