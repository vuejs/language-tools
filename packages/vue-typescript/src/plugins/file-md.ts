import { VueLanguagePlugin } from '../vueFile';
import { SourceMapBase, Mode } from '@volar/source-map';
import { CodeGen } from '@volar/code-gen';

export default function (): VueLanguagePlugin {

	return {

		compileFileToVue(fileName, content) {

			if (fileName.endsWith('.md')) {

				const _content = content;

				content = content
					// inline code block
					.replace(/```[\s\S]*?```/g, match => '```' + ' '.repeat(match.length - 6) + '```')
					// inline code block
					.replace(/`[\s\S]*?`/g, match => `\`${' '.repeat(match.length - 2)}\``)
					// # \<script setup>
					.replace(/\\<[\s\S]*?\n?/g, match => ' '.repeat(match.length));

				const scriptBlockReg = /\<script[\s\S]*?\>([\s\S]*?)\<\/script\>/g;
				const styleBlockReg = /\<style[\s\S]*?\>([\s\S]*?)\<\/style\>/g;

				const scriptBlocks: [number, number][] = [];
				const styleBlocks: [number, number][] = [];

				for (const match of content.matchAll(scriptBlockReg)) {
					if (match.index !== undefined) {
						const matchText = match[0];
						scriptBlocks.push([match.index, match.index + matchText.length]);
					}
				}

				for (const match of content.matchAll(styleBlockReg)) {
					if (match.index !== undefined) {
						const matchText = match[0];
						styleBlocks.push([match.index, match.index + matchText.length]);
					}
				}

				content = content
					.replace(scriptBlockReg, match => ' '.repeat(match.length))
					.replace(styleBlockReg, match => ' '.repeat(match.length))
					// angle bracket: <http://foo.com>
					.replace(/\<\S*\:\S*\>/g, match => ' '.repeat(match.length))
					// [foo](http://foo.com)
					.replace(/\[[\s\S]*?\]\([\s\S]*?\)/g, match => ' '.repeat(match.length));

				const codeGen = new CodeGen();

				for (const block of [
					...scriptBlocks,
					...styleBlocks,
				]) {
					codeGen.addCode(
						_content.substring(block[0], block[1]),
						{
							start: block[0],
							end: block[1],
						},
						Mode.Offset,
						undefined,
					);
					codeGen.addText('\n\n');
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
				codeGen.addText('\n');
				codeGen.addText('\n</template>\n');

				const sourceMap = new SourceMapBase(codeGen.getMappings());

				return {
					vue: codeGen.getText(),
					mapping: vueRange => sourceMap.getSourceRange(vueRange.start, vueRange.end)?.[0],
					sourceMap, // for create virtual embedded vue file
				};
			};
		}
	};
}
