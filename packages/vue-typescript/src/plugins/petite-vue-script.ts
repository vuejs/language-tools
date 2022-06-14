import { CodeGen } from '@volar/code-gen';
import { EmbeddedFileMappingData } from '@volar/vue-code-gen';
import { EmbeddedFile, VueLanguagePlugin } from '../sourceFile';

export default function (
	ts: typeof import('typescript/lib/tsserverlibrary'),
): VueLanguagePlugin {

	return {

		getEmbeddedFilesCount(fileName, sfc) {
			return fileName.endsWith('.html') ? 1 : 0;
		},

		getEmbeddedFile(fileName, sfc, i) {

			if (sfc.script) {

				const ast = ts.createSourceFile(fileName, sfc.script.content, ts.ScriptTarget.Latest);
				let createAppArgRange: [number, number] | undefined;

				ast.forEachChild(child => walkNode(child));

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
				if (createAppArgRange) {
					const createAppArgText = sfc.script.content.slice(createAppArgRange[0], createAppArgRange[1]);
					if (createAppArgText.trim()) {
						codeGen.addCode2(createAppArgText, createAppArgRange[0], {
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
				}
				else {
					codeGen.addText('{}');
				}
				codeGen.addText(';\n');
				codeGen.addText(`const __VLS_ctx = (await import('vue')).defineComponent({});\n`);
				codeGen.addText(`declare const __VLS_export: new () => typeof __VLS_scope & import('./__VLS_types').PickNotAny<InstanceType<typeof __VLS_ctx>, {}>;\n`);
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

				function walkNode(node: ts.Node) {
					if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'createApp') {
						if (node.arguments.length) {
							const arg0 = node.arguments[0];
							createAppArgRange = [arg0.getStart(ast), arg0.getEnd()];
						}
					}
					else {
						node.forEachChild(child => walkNode(child));
					}
				}
			}
		},
	};
}
