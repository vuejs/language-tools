import { CodeGen } from '@volar/code-gen';
import { Mode } from '@volar/source-map';
import { VueLanguagePlugin } from '../vueFile';

export default function (): VueLanguagePlugin {

	return {

		compileFileToVue(fileName, content) {

			if (fileName.endsWith('.md')) {

				content = content
					// code block
					.replace(/```[\s\S]*?```/g, match => '```' + ' '.repeat(match.length - 6) + '```')
					// inline code block
					.replace(/`[\s\S]*?`/g, match => `\`${' '.repeat(match.length - 2)}\``)
					// # \<script setup>
					.replace(/\\\<[\s\S]*?\>\n?/g, match => ' '.repeat(match.length));

				const sfcBlockReg = /\<(script|style)[\s\S]*?\>([\s\S]*?)\<\/\1\>/g;
				const codeGen = new CodeGen();

				for (const match of content.matchAll(sfcBlockReg)) {
					if (match.index !== undefined) {
						const matchText = match[0];
						codeGen.addCode2(matchText, match.index, undefined);
						codeGen.addText('\n\n');
						content = content.substring(0, match.index) + ' '.repeat(matchText.length) + content.substring(match.index + matchText.length);
					}
				}

				content = content
					// angle bracket: <http://foo.com>
					.replace(/\<\S*\:\S*\>/g, match => ' '.repeat(match.length))
					// [foo](http://foo.com)
					.replace(/\[[\s\S]*?\]\([\s\S]*?\)/g, match => ' '.repeat(match.length));

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
