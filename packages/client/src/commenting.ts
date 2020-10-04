import { commands, TextDocument, LanguageConfiguration } from 'vscode';
import * as vscode from 'vscode';
import { Range } from 'vscode-languageclient';

const command = 'volar.action.comment';
const languagesConfigs = new Map<string, LanguageConfiguration>();
languagesConfigs.set('vue', require('../../../languages/html.json'));
languagesConfigs.set('html', require('../../../languages/html.json'));
languagesConfigs.set('pug', require('../../../languages/pug.json'));
languagesConfigs.set('css', require('../../../languages/css.json'));
languagesConfigs.set('scss', require('../../../languages/scss.json'));
languagesConfigs.set('typescript', require('../../../languages/typescript.json'));
languagesConfigs.set('javascript', require('../../../languages/typescript.json'));

export function activateCommenting(embeddedLanguageRequestor: (document: TextDocument, range: vscode.Range) => Thenable<{
	id: string,
	range: Range,
} | undefined>) {

	return commands.registerCommand(command, commandHandler);

	async function commandHandler() {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			return;
		}

		const selection = editor.selection;
		const activeDocument = editor.document;
		if (activeDocument.languageId !== 'vue') {
			return;
		}

		// TODO: get in client
		const embeddedLanguage = await embeddedLanguageRequestor(activeDocument, selection);
		if (!embeddedLanguage) {
			return;
		}

		const languageConfig = languagesConfigs.get(embeddedLanguage.id);
		if (!languageConfig) {
			return;
		}

		const editRange = new vscode.Range(
			Math.max(selection.start.line, embeddedLanguage.range.start.line),
			selection.start.line === embeddedLanguage.range.start.line ? embeddedLanguage.range.start.character : 0,
			Math.min(selection.end.line, embeddedLanguage.range.end.line),
			selection.end.line === embeddedLanguage.range.end.line
				? embeddedLanguage.range.end.character
				: activeDocument.positionAt(activeDocument.offsetAt(new vscode.Position(selection.end.line + 1, 0)) - 1).character
		);
		const sourceText = activeDocument.getText(editRange);

		let newText: string | undefined;

		const lineComment = languageConfig?.comments?.lineComment;
		if (lineComment && embeddedLanguage.range.start.line !== embeddedLanguage.range.end.line) {
			const lines = sourceText.split('\n');
			const trimedLines = lines.map(line => getLineTrimText(line));
			const minTrimedLength = Math.min(...trimedLines.map(trimed => trimed.start));
			let isAllCommented = true;
			for (const trimedLine of trimedLines) {
				if (trimedLine.text === '') continue;
				if (!isCommented(trimedLine.text, lineComment)) {
					isAllCommented = false;
					break;
				}
			}
			if (!isAllCommented) {
				let resultLines: string[] = [];
				for (let i = 0; i < lines.length; i++) {
					const line = lines[i];
					const trimed = trimedLines[i];
					if (trimed.text === '') {
						resultLines.push('');
					}
					else {
						resultLines.push(line.substring(0, minTrimedLength) + [lineComment, line.substring(minTrimedLength)].join(' '));
					}
				}
				newText = resultLines.join('\n');
			}
			else {
				let resultLines: string[] = [];
				for (let i = 0; i < lines.length; i++) {
					const line = lines[i];
					const trimed = trimedLines[i];
					let newLine = trimed.text.substring(lineComment.length);
					if (newLine.startsWith(' ')) newLine = newLine.substring(1);
					newLine = line.substring(0, trimed.start) + newLine;
					resultLines.push(newLine);
				}
				newText = resultLines.join('\n');
			}
		}

		const blockComment = languageConfig?.comments?.blockComment;
		if (blockComment && newText === undefined) {
			const trimed = getBlockTrimText(sourceText);
			if (!isCommented(trimed.text, blockComment[0], blockComment[1])) {
				newText = [blockComment[0], trimed.text, blockComment[1]].join(' ');
				newText = sourceText.substr(0, trimed.start) + newText + sourceText.substr(trimed.end);
			}
			else {
				newText = trimed.text.substring(blockComment[0].length, trimed.text.length - blockComment[1].length);
				if (newText.startsWith(' ')) newText = newText.substring(1);
				if (newText.endsWith(' ')) newText = newText.substring(0, newText.length - 1);
				newText = sourceText.substr(0, trimed.start) + newText + sourceText.substr(trimed.end);
			}
		}

		// TODO: update selection range
		if (newText !== undefined) {
			editor.edit(editBuilder => {
				editBuilder.replace(editRange, newText!);
			});
		}
	};
}

function isCommented(text: string, commentStart: string, commentEnd?: string) {
	text = text.trim();
	return text.startsWith(commentStart) && (!commentEnd || text.endsWith(commentEnd));
}
function getLineTrimText(text: string) {
	let trimText = text.trimStart();
	let trimStart = text.length - trimText.length;
	return {
		text: trimText,
		start: trimStart,
	}
}
function getBlockTrimText(text: string) {
	let trimText = text.trimStart();
	let trimStart = text.length - trimText.length;
	trimText = trimText.trimEnd();
	return {
		text: trimText,
		start: trimStart,
		end: trimText.length + trimStart
	}
}
