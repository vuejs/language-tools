import { CodeGen } from '@volar/code-gen';
import { Mode } from '@volar/source-map';
import { VueLanguagePlugin } from '../sourceFile';

export default function (): VueLanguagePlugin {

	return {

		compileFileToVue(fileName, content) {

			if (fileName.endsWith('.html')) {

				let newContent = content;
				let isTs = false;

				const sfcBlockReg = /\<(script|style)[\s\S]*?\>([\s\S]*?)\<\/\1\>/g;
				const codeGen = new CodeGen();

				for (const match of content.matchAll(sfcBlockReg)) {
					if (match.index !== undefined) {
						const matchText = match[0];
						// ignore `<script src="...">`
						if (matchText.startsWith('<script') && matchText.indexOf('src=') >= 0) {
							newContent = newContent.substring(0, match.index) + ' '.repeat(matchText.length) + newContent.substring(match.index + matchText.length);
						}
						else if (matchText.startsWith('<style')) {
							codeGen.addCode2(matchText, match.index, undefined);
							codeGen.addText('\n\n');
							newContent = newContent.substring(0, match.index) + ' '.repeat(matchText.length) + newContent.substring(match.index + matchText.length);
						}

						if (matchText.startsWith('<script') && (
							matchText.indexOf('lang="ts"') >= 0 ||
							matchText.indexOf('lang="tsx"') >= 0
						)) {
							isTs = true;
						}
					}
				}

				newContent = newContent.replace(/<script[\s\S]*?>/g, str => `<vls-sr${' '.repeat(str.length - '<script>'.length)}>`);
				newContent = newContent.replace(/<\/script>/g, '</vls-sr>');

				codeGen.addText('<template>\n');
				codeGen.addCode2(newContent, 0, undefined);
				codeGen.addText('\n</template>');

				if (isTs) {
					codeGen.addText('\n<script setup lang="ts"></script>');
				}

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
