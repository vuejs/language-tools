import * as shared from '@volar/shared';
import * as vscode from 'vscode-languageserver';
import { parseUnuseScriptSetupRanges } from '../parsers/scriptSetupConvertRanges';
import type { TextRange } from '../parsers/types';
import type { ApiLanguageServiceContext } from '../types';
import * as codeAction from '../services/codeAction';
import * as codeActionResolve from '../services/codeActionResolve';
import * as diagnostics from '../services/diagnostics';

export function register(context: ApiLanguageServiceContext) {

	const { sourceFiles, modules: { typescript: ts } } = context;
	const getDiagnostics = diagnostics.register(context, () => { });
	const getCodeActions = codeAction.register(context);
	const resolveCodeAction = codeActionResolve.register(context);

	return async (connection: vscode.Connection, uri: string) => {

		const sourceFile = sourceFiles.get(uri);
		if (!sourceFile) return;

		const descriptor = sourceFile.getDescriptor();
		if (!descriptor.scriptSetup) return;

		const scriptSetupAst = sourceFile.getScriptSetupAst();
		if (!scriptSetupAst) return;

		const edits = await getEdits(
			sourceFile,
			descriptor.script,
			descriptor.scriptSetup,
			sourceFile.getScriptAst(),
			scriptSetupAst,
		);

		if (edits?.length) {

			await connection.workspace.applyEdit({ changes: { [uri]: edits } });
			await shared.sleep(0);

			const errors = await getDiagnostics(uri, () => { }) ?? [];
			await shared.sleep(0);

			const importEdits = await getAddMissingImportsEdits(sourceFile, descriptor.script!, errors);

			if (importEdits) {
				await connection.workspace.applyEdit(importEdits);
			}
		}

		async function getAddMissingImportsEdits(
			_sourceFile: NonNullable<typeof sourceFile>,
			_script: NonNullable<typeof descriptor['script']>,
			errors: vscode.Diagnostic[],
		) {

			const document = _sourceFile.getTextDocument();
			const codeActions = await getCodeActions(uri, {
				start: document.positionAt(_script.startTagEnd),
				end: document.positionAt(_script.startTagEnd),
			}, {
				diagnostics: errors.filter(error => error.code === 2552),
				only: [`${vscode.CodeActionKind.Source}.addMissingImports.ts`],
			});

			for (const codeAction of codeActions) {
				const newCodeAction = await resolveCodeAction(codeAction);
				if (newCodeAction.edit) {
					return newCodeAction.edit;
				}
			}
		}
		async function getEdits(
			_sourceFile: NonNullable<typeof sourceFile>,
			_script: typeof descriptor['script'],
			_scriptSetup: NonNullable<typeof descriptor['scriptSetup']>,
			_scriptAst: typeof scriptSetupAst,
			_scriptSetupAst: NonNullable<typeof scriptSetupAst>,
		) {

			const ranges = parseUnuseScriptSetupRanges(ts, _scriptSetupAst);
			const document = _sourceFile.getTextDocument();
			const edits: vscode.TextEdit[] = [];
			const removeSetupTextRanges: TextRange[] = [...ranges.imports];

			const sfcCode = document.getText();
			const setupAttr = sfcCode.substring(0, _scriptSetup.startTagEnd).lastIndexOf(' setup');

			edits.push(vscode.TextEdit.replace(
				{
					start: document.positionAt(setupAttr),
					end: document.positionAt(setupAttr + ' setup'.length),
				},
				''
			));
			if (_script) {
				edits.push(vscode.TextEdit.replace(
					{
						start: {
							line: document.positionAt(_script.startTagEnd).line,
							character: 0,
						},
						end: {
							line: document.positionAt(_script.startTagEnd + _script.content.length).line + 1,
							character: 0,
						},
					},
					''
				));
			}

			if (ranges.defineProps) {
				removeSetupTextRanges.push(ranges.defineProps.range);
			}
			if (ranges.defineEmits) {
				removeSetupTextRanges.push(ranges.defineEmits.range);
			}
			if (ranges.useSlots) {
				removeSetupTextRanges.push(ranges.useSlots.range);
			}
			if (ranges.useAttrs) {
				removeSetupTextRanges.push(ranges.useAttrs.range);
			}

			let newScriptCode = '';

			for (const setupImport of ranges.imports) {
				newScriptCode += _scriptSetup.content.substring(setupImport.start, setupImport.end);
				newScriptCode += '\n';
			}
			if (_script) {
				newScriptCode += _script.content;
			}

			newScriptCode += '\n';
			newScriptCode += 'export default defineComponent({\n';

			if (ranges.defineProps && 'args' in ranges.defineProps) {
				newScriptCode += 'props: ';
				newScriptCode += _scriptSetup.content.substring(ranges.defineProps.args.start, ranges.defineProps.args.end);
				newScriptCode += ',\n';
			}

			if (ranges.defineProps && 'typeArgs' in ranges.defineProps) {
				newScriptCode += 'props: {\n';
				for (const typeProp of ranges.defineProps.typeArgs) {
					const nameString = _scriptSetup.content.substring(typeProp.name.start, typeProp.name.end);
					const typeString = getTypeObject(typeProp.type);
					if (!typeProp.required && !typeProp.default) {
						newScriptCode += `${nameString}: ${typeString},\n`;
					}
					else {
						newScriptCode += `${nameString}: {\n`;
						newScriptCode += `type: ${typeString},\n`;
						if (typeProp.required) {
							newScriptCode += `required: true,\n`;
						}
						if (typeProp.default) {
							newScriptCode += `default: ${_scriptSetup.content.substring(typeProp.default.start, typeProp.default.end)},\n`;
						}
						newScriptCode += '},\n';
					}
				}
				newScriptCode += '},\n';
			}

			if (ranges.defineEmits && 'args' in ranges.defineEmits) {
				newScriptCode += 'emits: ';
				newScriptCode += _scriptSetup.content.substring(ranges.defineEmits.args.start, ranges.defineEmits.args.end);
				newScriptCode += ',\n';
			}

			if (ranges.defineEmits && 'typeArgs' in ranges.defineEmits) {
				newScriptCode += 'emits: {\n';
				for (const typeProp of ranges.defineEmits.typeArgs) {
					const nameString = _scriptSetup.content.substring(typeProp.name.start, typeProp.name.end);
					newScriptCode += `${nameString}: (`;
					if (typeProp.restArgs) {
						newScriptCode += _scriptSetup.content.substring(typeProp.restArgs.start, typeProp.restArgs.end);
					}
					newScriptCode += `) => true,\n`;
				}
				newScriptCode += '},\n';
			}

			{
				newScriptCode += 'setup(';

				let addedProps = false;

				if (ranges.defineProps?.binding) {
					newScriptCode += _scriptSetup.content.substring(ranges.defineProps.binding.start, ranges.defineProps.binding.end);
					addedProps = true;
				}

				const contextProps: string[] = [];

				if (ranges.defineEmits?.binding) {
					contextProps.push(getContextPropText(ranges.defineEmits.binding, 'emit'));
				}
				if (ranges.useSlots?.binding) {
					contextProps.push(getContextPropText(ranges.useSlots.binding, 'slots'));
				}
				if (ranges.useAttrs?.binding) {
					contextProps.push(getContextPropText(ranges.useAttrs.binding, 'attrs'));
				}

				if (contextProps.length) {
					tryAddProps();
					newScriptCode += ', { ';
					newScriptCode += contextProps.join(', ');
					newScriptCode += ' }';
				}

				newScriptCode += ') {\n';
				newScriptCode += getSetupOptionCode();
				newScriptCode += '\n';
				newScriptCode += 'return {\n';
				for (const binding of ranges.bindings) {
					newScriptCode += _scriptSetup.content.substring(binding.start, binding.end) + ',\n';
				}
				newScriptCode += '};\n';
				newScriptCode += '},\n';

				function tryAddProps() {
					if (!addedProps) {
						newScriptCode += '_props';
						addedProps = true;
					}
				}
				function getContextPropText(textSetupRange: TextRange, defaultName: string) {
					const text = _scriptSetup.content.substring(textSetupRange.start, textSetupRange.end);
					if (text !== defaultName) {
						return `${defaultName}: ${text}`;
					}
					else {
						return text;
					}
				}
			}

			newScriptCode += '});\n';

			addReplace(0, _scriptSetup.content.length, '\n' + newScriptCode.trim() + '\n');

			return edits;

			function getSetupOptionCode() {
				let text = _scriptSetup.content;
				for (const range of removeSetupTextRanges.sort((a, b) => b.start - a.start)) {
					let end = range.end;
					if (text.substring(end, end + 1) === ';')
						end++;
					text = text.substring(0, range.start) + text.substring(end);
				}
				return text.trim();
			}
			function getTypeObject(typeSetupRange: TextRange) {

				const typeText = _scriptSetup.content.substring(typeSetupRange.start, typeSetupRange.end);

				switch (typeText) {
					case 'Function': return 'Function';
					case 'string': return 'String';
					case 'boolean': return 'Boolean';
					case 'number': return 'Number';
					case 'object': return 'Object';
				}

				if (typeText.endsWith(']'))
					return `Array as PropType<${typeText}>`;

				if (typeText.endsWith('}'))
					return `Object as PropType<${typeText}>`;

				return `null as any as PropType<${typeText}>`;
			}
			function addReplace(start: number, end: number, text: string) {

				if (_scriptSetup.content.substring(start, end) === text)
					return;

				edits.push(vscode.TextEdit.replace(
					{
						start: document.positionAt(_scriptSetup.startTagEnd + start),
						end: document.positionAt(_scriptSetup.startTagEnd + end),
					},
					text
				));
			}
		}
	};
}
