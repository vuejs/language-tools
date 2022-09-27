import useCssPlugin from '@volar-plugins/css';
import useTsPlugin, { getSemanticTokenLegend } from '@volar-plugins/typescript';
import { LanguageServerPlugin } from '@volar/language-server';
import { createLanguageServer, EmbeddedLanguageModule, SourceFile } from '@volar/language-server/node';
import { Mapping, MappingKind } from '@volar/source-map';

const blocksReg = /\<(script|style)[\s\S]*?\>([\s\S]*?)\<\/\1\>/g;

const mod: EmbeddedLanguageModule<SourceFile & { snapshot: any; }> = {
	createSourceFile(fileName, snapshot) {
		if (fileName.endsWith('.svelte')) {

			const text = snapshot.getText(0, snapshot.getLength());

			return {
				snapshot,
				fileName,
				text,
				embeddeds: getEmbeddeds(fileName, text),
			};
		}
	},
	updateSourceFile(sourceFile, snapshot) {

		const change = snapshot.getChangeRange(sourceFile.snapshot);

		sourceFile.text = snapshot.getText(0, snapshot.getLength());
		sourceFile.snapshot = snapshot;

		let incrementalUpdateFailed = false;

		if (change) {

			const changeStart = change.span.start;
			const changeEnd = change.span.start + change.span.length;
			const newText = snapshot.getText(changeStart, changeStart + change.newLength);
			const lengthDiff = change.newLength - (changeEnd - changeStart);

			for (const embedded of sourceFile.embeddeds) {

				const blockStart = embedded.mappings[0].sourceRange.start;
				const blockEnd = embedded.mappings[0].sourceRange.end;

				if (changeStart >= blockStart && changeEnd <= blockEnd) {
					const a = snapshot.getText(blockStart, changeStart);
					const b = newText;
					const c = snapshot.getText(changeEnd + lengthDiff, blockEnd + lengthDiff);
					embedded.text = a + b + c;
					embedded.mappings[0].mappedRange.end += lengthDiff;
					embedded.mappings[0].sourceRange.end += lengthDiff;
				}
				else if (changeEnd <= blockStart && changeStart < blockStart) {
					embedded.mappings[0].sourceRange.start += lengthDiff;
					embedded.mappings[0].sourceRange.end += lengthDiff;
				}
				else if (changeStart >= blockEnd && changeEnd > blockEnd) {
					// No need update
				}
				else {
					incrementalUpdateFailed = true;
				}
			}
		}
		else {
			incrementalUpdateFailed = true;
		}

		if (incrementalUpdateFailed) {
			// full update
			sourceFile.embeddeds = getEmbeddeds(sourceFile.fileName, sourceFile.text);
		}
	},
};

function getEmbeddeds(fileName: string, text: string) {
	return [...text.matchAll(blocksReg)].map(block => {
		const content = block[2];
		const start = block.index! + block[0].indexOf(content);
		const end = start + content.length;;
		return {
			fileName: fileName + (block[1] === 'script' ? '.js' : '.css'),
			text: block[2],
			isTsHostFile: block[1] === 'script',
			capabilities: {
				diagnostics: true,
				foldingRanges: true,
				documentSymbol: true,
				codeActions: true,
				inlayHints: true,
				formatting: { initialIndentBracket: ['{', '}'] as [string, string] },
				// formatting: true,
			},
			mappings: [
				{
					sourceRange: { start, end },
					mappedRange: { start: 0, end: content.length },
					kind: MappingKind.Offset,
					data: {
						hover: true,
						references: true,
						definitions: true,
						rename: true,
						completion: true,
						diagnostic: true,
						semanticTokens: true,
					},
				}
			]satisfies Mapping[],
			embeddeds: [],
		};
	});
}

const plugin: LanguageServerPlugin = () => ({
	extensions: ['.svelte'],
	languageService: {
		semanticTokenLegend: getSemanticTokenLegend(),
		getLanguageModules(host) {
			return [mod];
		},
		getServicePlugins() {
			return [
				useCssPlugin(),
				useTsPlugin(),
			];
		},
	},
	documentService: {
		getLanguageModules(host) {
			return [mod];
		},
		getServicePlugins() {
			return [
				useCssPlugin(),
				useTsPlugin(),
			];
		}
	},
});

createLanguageServer([plugin]);
