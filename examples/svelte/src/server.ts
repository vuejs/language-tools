import useCssPlugin from '@volar-plugins/css';
import useTsPlugin, { getSemanticTokenLegend } from '@volar-plugins/typescript';
import { EmbeddedFile, EmbeddedFileKind, LanguageServerPlugin } from '@volar/language-server';
import { createLanguageServer, EmbeddedLanguageModule, SourceFile } from '@volar/language-server/node';

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

				const firstMapping = embedded.mappings[0];
				const sourceRange = firstMapping.sourceRange;
				const blockStart = sourceRange[0];
				const blockEnd = sourceRange[1];

				if (changeStart >= blockStart && changeEnd <= blockEnd) {
					const a = snapshot.getText(blockStart, changeStart);
					const b = newText;
					const c = snapshot.getText(changeEnd + lengthDiff, blockEnd + lengthDiff);
					embedded.text = a + b + c;
					embedded.mappings[0].generatedRange[1] += lengthDiff;
					embedded.mappings[0].sourceRange[1] += lengthDiff;
				}
				else if (changeEnd <= blockStart && changeStart < blockStart) {
					embedded.mappings[0].sourceRange[0] += lengthDiff;
					embedded.mappings[0].sourceRange[1] += lengthDiff;
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
	return [...text.matchAll(blocksReg)].map<EmbeddedFile>(block => {
		const content = block[2];
		const start = block.index! + block[0].indexOf(content);
		const tag = block[1];
		return blockToEmbeddedFile(fileName, content, start, tag);
	});
}

function blockToEmbeddedFile(fileName: string, blockText: string, blockOffset: number, tag: string): EmbeddedFile {
	return {
		fileName: fileName + (tag === 'script' ? '.js' : '.css'),
		text: blockText,
		kind: tag === 'script' ? EmbeddedFileKind.TypeScriptHostFile : EmbeddedFileKind.TextFile,
		capabilities: {
			diagnostic: true,
			foldingRange: true,
			documentSymbol: true,
			codeAction: true,
			inlayHint: true,
			documentFormatting: { initialIndentBracket: ['{', '}'] as [string, string] },
		},
		mappings: [{
			sourceRange: [blockOffset, blockOffset + blockText.length],
			generatedRange: [0, blockText.length],
			data: {
				hover: true,
				references: true,
				definition: true,
				rename: true,
				completion: true,
				diagnostic: true,
				semanticTokens: true,
			},
		}],
		embeddeds: [],
	};
}

const plugin: LanguageServerPlugin = () => ({
	extraFileExtensions: [{ extension: 'svelte', isMixedContent: true, scriptKind: 7 }],
	semanticService: {
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
	syntacticService: {
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
