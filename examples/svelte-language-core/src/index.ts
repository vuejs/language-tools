import { decode } from '@jridgewell/sourcemap-codec';
import { EmbeddedFile, EmbeddedFileKind, LanguageModule } from '@volar/language-core';
import { svelte2tsx } from 'svelte2tsx';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { URI } from 'vscode-uri';

export * from '@volar/language-core';

export const languageModule: LanguageModule = {
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
		sourceFile.text = snapshot.getText(0, snapshot.getLength());
		sourceFile.embeddeds = getEmbeddeds(sourceFile.fileName, sourceFile.text);
	},
};

function getEmbeddeds(fileName: string, text: string) {

	try {
		const tsx = svelte2tsx(text, {
			filename: fileName,
			isTsFile: true,
			mode: 'ts',
		});
		const v3Mappings = decode(tsx.map.mappings);
		const sourcedDoc = TextDocument.create(URI.file(fileName).toString(), 'svelte', 0, text);
		const genDoc = TextDocument.create(URI.file(fileName + '.tsx').toString(), 'typescriptreact', 0, tsx.code);
		const mappings: EmbeddedFile['mappings'] = [];

		let current: {
			genOffset: number,
			sourceOffset: number,
		} | undefined;

		for (let genLine = 0; genLine < v3Mappings.length; genLine++) {
			for (const segment of v3Mappings[genLine]) {
				const genCharacter = segment[0];
				const genOffset = genDoc.offsetAt({ line: genLine, character: genCharacter });
				if (current) {
					let length = genOffset - current.genOffset;
					const sourceText = text.substring(current.sourceOffset, current.sourceOffset + length);
					const genText = tsx.code.substring(current.genOffset, current.genOffset + length);
					if (sourceText !== genText) {
						length = 0;
						for (let i = 0; i < genOffset - current.genOffset; i++) {
							if (sourceText[i] === genText[i]) {
								length = i + 1;
							}
							else {
								break;
							}
						}
					}
					if (length > 0) {
						const lastMapping = mappings.length ? mappings[mappings.length - 1] : undefined;
						if (lastMapping && lastMapping.generatedRange[1] === current.genOffset && lastMapping.sourceRange[1] === current.sourceOffset) {
							lastMapping.generatedRange[1] = current.genOffset + length;
							lastMapping.sourceRange[1] = current.sourceOffset + length;
						}
						else {
							mappings.push({
								sourceRange: [current.sourceOffset, current.sourceOffset + length],
								generatedRange: [current.genOffset, current.genOffset + length],
								data: {
									hover: true,
									references: true,
									definition: true,
									rename: true,
									completion: true,
									diagnostic: true,
									semanticTokens: true,
								},
							});
						}
					}
					current = undefined;
				}
				if (segment[2] !== undefined && segment[3] !== undefined) {
					const sourceOffset = sourcedDoc.offsetAt({ line: segment[2], character: segment[3] });
					current = {
						genOffset,
						sourceOffset,
					};
				}
			}
		}

		const embeddeds: EmbeddedFile[] = [];

		embeddeds.push({
			fileName: fileName + '.ts',
			text: tsx.code,
			kind: EmbeddedFileKind.TypeScriptHostFile,
			capabilities: {
				diagnostic: true,
				foldingRange: false,
				documentSymbol: false,
				codeAction: true,
				inlayHint: true,
				documentFormatting: false,
			},
			mappings: mappings,
			embeddeds: [],
		});

		return embeddeds;
	}
	catch {
		return [];
	}
}
