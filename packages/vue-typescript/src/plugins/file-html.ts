import { CodeGen } from '@volar/code-gen';
import { Mode } from '@volar/source-map';
import { VueLanguagePlugin } from '../sourceFile';

export default function (): VueLanguagePlugin {

	return {

		compileFileToVue(fileName, content) {

			if (fileName.endsWith('.html')) {

				const sfcBlockReg = /\<(script|style)[\s\S]*?\>([\s\S]*?)\<\/\1\>/g;
				const codeGen = new CodeGen();

				for (const match of content.matchAll(sfcBlockReg)) {
					if (match.index !== undefined) {
						const matchText = match[0];
						// only access script block, ignore style block and `<script src="...">`
						// style block intellisense support by vscode-html-language-features
						if (matchText.startsWith('<script') && matchText.indexOf('src=') === -1) {
							// monkey fix replace `<script type="module">` to `<script setup>`
							codeGen.addCode2(matchText, match.index, undefined);
						}
						codeGen.addText('\n\n');
						content = content.substring(0, match.index) + ' '.repeat(matchText.length) + content.substring(match.index + matchText.length);
					}
				}

				codeGen.addText('<template>\n');
				codeGen.addCode(
					content,
					{
						start: 0,
						end: content.length,
					},
					Mode.Offset,
					undefined,
				);
				codeGen.addText('\n</template>');

				return {
					vue: codeGen.getText(),
					mappings: codeGen.getMappings().map(mapping => ({
						fileOffset: mapping.sourceRange.start,
						vueOffset: mapping.mappedRange.start,
						length: mapping.mappedRange.end - mapping.mappedRange.start,
					})),
				};
			};
		}
	};
}
