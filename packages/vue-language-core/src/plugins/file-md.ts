import { buildMappings, toString, Chunk } from '@volar/code-gen';
import { SourceMapBase } from '@volar/source-map';
import { parse, SFCBlock } from '@vue/compiler-sfc';
import { VueLanguagePlugin } from '../types';

const plugin: VueLanguagePlugin = () => {

	return {

		version: 1,

		parseSFC(fileName, content) {

			if (fileName.endsWith('.md')) {

				content = content
					// code block
					.replace(/```[\s\S]*?```/g, match => '```' + ' '.repeat(match.length - 6) + '```')
					// inline code block
					.replace(/`[\s\S]*?`/g, match => `\`${' '.repeat(match.length - 2)}\``)
					// # \<script setup>
					.replace(/\\\<[\s\S]*?\>\n?/g, match => ' '.repeat(match.length));

				const sfcBlockReg = /\<(script|style)[\s\S]*?\>([\s\S]*?)\<\/\1\>/g;
				const codeGen: Chunk[] = [];

				for (const match of content.matchAll(sfcBlockReg)) {
					if (match.index !== undefined) {
						const matchText = match[0];
						codeGen.push([matchText, undefined, match.index]);
						codeGen.push('\n\n');
						content = content.substring(0, match.index) + ' '.repeat(matchText.length) + content.substring(match.index + matchText.length);
					}
				}

				content = content
					// angle bracket: <http://foo.com>
					.replace(/\<\S*\:\S*\>/g, match => ' '.repeat(match.length))
					// [foo](http://foo.com)
					.replace(/\[[\s\S]*?\]\([\s\S]*?\)/g, match => ' '.repeat(match.length));

				codeGen.push('<template>\n');
				codeGen.push([content, undefined, 0]);
				codeGen.push('\n</template>');

				const file2VueSourceMap = new SourceMapBase(buildMappings(codeGen));
				const sfc = parse(toString(codeGen), { sourceMap: false, ignoreEmpty: false });

				if (sfc.descriptor.template) {
					transformRange(sfc.descriptor.template);
				}
				if (sfc.descriptor.script) {
					transformRange(sfc.descriptor.script);
				}
				if (sfc.descriptor.scriptSetup) {
					transformRange(sfc.descriptor.scriptSetup);
				}
				for (const style of sfc.descriptor.styles) {
					transformRange(style);
				}
				for (const customBlock of sfc.descriptor.customBlocks) {
					transformRange(customBlock);
				}

				return sfc;

				function transformRange(block: SFCBlock) {
					const fileRange = file2VueSourceMap.getSourceRange(block.loc.start.offset, block.loc.end.offset)?.[0];
					if (fileRange) {
						block.loc.start.offset = fileRange.start;
						block.loc.end.offset = fileRange.end;
					}
					else {
						block.loc.start.offset = -1;
						block.loc.end.offset = -1;
					}
				}
			};
		}
	};
};
export = plugin;
