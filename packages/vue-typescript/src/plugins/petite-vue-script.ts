import { CodeGen } from '@volar/code-gen';
import { EmbeddedFileMappingData } from '@volar/vue-code-gen';
import { EmbeddedFile, VueLanguagePlugin } from '../sourceFile';

export default function (): VueLanguagePlugin {

	return {

		getEmbeddedFilesCount(fileName, sfc) {
			return fileName.endsWith('.html') ? 1 : 0;
		},

		getEmbeddedFile(fileName, sfc, i) {

			if (sfc.script) {

				const createVueArg = sfc.script.content.match(/createApp\s*\(([\s\S]*?)\)/);
				const codeGen = new CodeGen<EmbeddedFileMappingData>();

				codeGen.addCode2(sfc.script.content, 0, {
					vueTag: 'script',
					capabilities: {
						basic: true,
						references: true,
						definitions: true,
						diagnostic: true,
						rename: true,
						completion: true,
						semanticTokens: true,
					},
				});

				codeGen.addText('\n\n');
				codeGen.addText(`const __VLS_scope = `);
				if (createVueArg && createVueArg.index !== undefined) {
					codeGen.addCode2(createVueArg[1], createVueArg.index + createVueArg[0].indexOf(createVueArg[1]), {
						vueTag: 'script',
						capabilities: {
							references: true,
							definitions: true,
							rename: true,
						},
					});
				}
				else {
					codeGen.addText('{}');
				}
				codeGen.addText(';\n');
				codeGen.addText('declare const __VLS_export: new () => typeof __VLS_scope;\n');
				codeGen.addText('export default __VLS_export;\n');

				const file: EmbeddedFile = {
					fileName: fileName + '.__VLS_script.' + sfc.script.lang,
					content: codeGen.getText(),
					capabilities: {
						diagnostics: true,
						foldingRanges: false,
						formatting: false,
						documentSymbol: false,
						codeActions: true,
						inlayHints: true,
					},
					isTsHostFile: true,
					mappings: codeGen.getMappings(),
				};

				return file;
			}
		},
	};
}
