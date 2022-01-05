import * as shared from '@volar/shared';
import { parseUseScriptSetupRanges } from '@volar/vue-code-gen/out/parsers/scriptSetupConvertRanges';
import type { TextRange } from '@volar/vue-code-gen/out/types';
import type { Connection } from 'vscode-languageserver';
import * as vscode from 'vscode-languageserver-protocol';
import type * as vue from 'vscode-vue-languageservice';

export async function execute(
	vueLs: vue.LanguageService,
	connection: Connection,
	uri: string,
) {

	const sourceFile = vueLs.__internal__.context.sourceFiles.get(uri);
	if (!sourceFile) return;

	const descriptor = sourceFile.getDescriptor();
	if (!descriptor.script) return;

	const scriptAst = sourceFile.getScriptAst();
	if (!scriptAst) return;

	const edits = await getEdits(
		sourceFile,
		descriptor.script,
		scriptAst,
	);

	if (edits?.length) {

		await connection.workspace.applyEdit({ changes: { [uri]: edits } });
		await shared.sleep(200);

		const importEdits = await getAddMissingImportsEdits(sourceFile, descriptor.scriptSetup!);
		if (importEdits) {
			await connection.workspace.applyEdit(importEdits);
		}
	}

	async function getAddMissingImportsEdits(
		_sourceFile: NonNullable<typeof sourceFile>,
		_scriptSetup: NonNullable<typeof descriptor['scriptSetup']>,
	) {

		const document = _sourceFile.getTextDocument();
		const codeActions = await vueLs.getCodeActions(uri, {
			start: document.positionAt(_scriptSetup.startTagEnd),
			end: document.positionAt(_scriptSetup.startTagEnd),
		}, {
			diagnostics: [],
			only: [`${vscode.CodeActionKind.Source}.addMissingImports.ts`],
		});

		for (const codeAction of codeActions) {
			const newCodeAction = await vueLs.doCodeActionResolve(codeAction);
			if (newCodeAction.edit) {
				return newCodeAction.edit;
			}
		}
	}
	async function getEdits(
		_sourceFile: NonNullable<typeof sourceFile>,
		_script: NonNullable<typeof descriptor['script']>,
		_scriptAst: NonNullable<typeof scriptAst>,
	) {

		const ranges = parseUseScriptSetupRanges(vueLs.__internal__.context.modules.typescript, _scriptAst);
		const document = _sourceFile.getTextDocument();
		const edits: vscode.TextEdit[] = [];
		const scriptStartPos = document.positionAt(_script.startTagEnd);
		const startTagText = document.getText({
			start: {
				line: scriptStartPos.line,
				character: 0,
			},
			end: scriptStartPos,
		});

		addReplace(-1, -1, ' setup');

		const newScriptSetupCode = getScriptSetupCode();
		const newScriptCode = getScriptCode();

		addReplace(0, _script.content.length, '\n' + newScriptSetupCode + '\n');

		if (newScriptCode !== '') {
			let newScriptBlock = `${startTagText}\n${newScriptCode}\n</script>\n\n`;
			addReplace(-startTagText.length, -startTagText.length, newScriptBlock);
		}

		return edits;

		function getScriptCode() {

			let scriptBodyCode = '';
			let scriptExportCode = '';

			for (const statement of ranges.otherScriptStatements) {
				const statementRange = getStatementRange(statement);
				scriptBodyCode += _script.content.substring(statementRange.start, statementRange.end) + '\n';
			}

			if (ranges.otherOptions.length) {
				scriptExportCode += 'export default defineComponent({\n';
				for (const otherOption of ranges.otherOptions) {
					scriptExportCode += _script.content.substring(otherOption.start, otherOption.end) + ',\n';
				}
				scriptExportCode += '});\n';
			}

			return [scriptBodyCode, scriptExportCode]
				.map(code => code.trim())
				.filter(code => code !== '')
				.join('\n\n');
		}
		function getScriptSetupCode() {

			let scriptSetupImportsCode = '';
			let scriptDefinesCode = '';
			let scriptSetupBodyCode = '';

			for (const importRange of ranges.imports) {
				let importRange_2 = getStatementRange(importRange);
				scriptSetupImportsCode += _script.content.substring(importRange_2.start, importRange_2.end) + '\n';
			}

			if (ranges.propsOption) {
				if (ranges.setupOption?.props) {
					scriptDefinesCode += `const ${_script.content.substring(ranges.setupOption.props.start, ranges.setupOption.props.end)} = `;
				}
				scriptDefinesCode += `defineProps(${_script.content.substring(ranges.propsOption.start, ranges.propsOption.end)});\n`;
			}
			if (ranges.setupOption?.context && 'start' in ranges.setupOption.context) {
				scriptDefinesCode += `const ${_script.content.substring(ranges.setupOption.context.start, ranges.setupOption.context.end)} = {\n`;
				if (ranges.emitsOption) {
					scriptDefinesCode += `emit: defineEmits(${_script.content.substring(ranges.emitsOption.start, ranges.emitsOption.end)}),\n`
				}
				scriptDefinesCode += `slots: useSlots(),\n`
				scriptDefinesCode += `attrs: useAttrs(),\n`
				scriptDefinesCode += '};\n';
			}
			else {
				if (ranges.emitsOption) {
					if (ranges.setupOption?.context && 'emit' in ranges.setupOption.context && ranges.setupOption.context.emit) {
						scriptDefinesCode += `const ${_script.content.substring(ranges.setupOption.context.emit.start, ranges.setupOption.context.emit.end)} = `;
					}
					scriptDefinesCode += `defineEmits(${_script.content.substring(ranges.emitsOption.start, ranges.emitsOption.end)});\n`;
				}
				if (ranges.setupOption?.context && 'slots' in ranges.setupOption.context && ranges.setupOption.context.slots) {
					scriptDefinesCode += `const ${_script.content.substring(ranges.setupOption.context.slots.start, ranges.setupOption.context.slots.end)} = useSlots();\n`;
				}
				if (ranges.setupOption?.context && 'attrs' in ranges.setupOption.context && ranges.setupOption.context.attrs) {
					scriptDefinesCode += `const ${_script.content.substring(ranges.setupOption.context.attrs.start, ranges.setupOption.context.attrs.end)} = useAttrs();\n`;
				}
			}

			if (ranges.setupOption) {
				const bodyRange = {
					start: ranges.setupOption.body.start + 1, // remove {
					end: ranges.setupOption.body.end - 1, // remove }
				};
				if (ranges.setupOption.bodyReturn) {
					const reutrnRange = getStatementRange(ranges.setupOption.bodyReturn);
					scriptSetupBodyCode = _script.content.substring(bodyRange.start, reutrnRange.start)
						+ _script.content.substring(reutrnRange.end, bodyRange.end);
				}
				else {
					scriptSetupBodyCode = _script.content.substring(bodyRange.start, bodyRange.end);
				}
			}

			return [scriptSetupImportsCode, scriptDefinesCode, scriptSetupBodyCode]
				.map(code => code.trim())
				.filter(code => code !== '')
				.join('\n\n');
		}
		function getStatementRange(scriptTextRange: TextRange) {
			let end = scriptTextRange.end;
			if (_script.content.substring(end, end + 1) === ';')
				end++;
			return {
				start: scriptTextRange.start,
				end,
			};
		}
		function addReplace(start: number, end: number, text: string) {
			edits.push(vscode.TextEdit.replace(
				{
					start: document.positionAt(_script.startTagEnd + start),
					end: document.positionAt(_script.startTagEnd + end),
				},
				text
			));
		}
	}
}
