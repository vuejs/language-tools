import { buildMappings, Segment, SourceMap, toString } from '@volar/source-map';
import { SFCBlock } from '@vue/compiler-sfc';
import { VueLanguagePlugin } from '../types';
import { parse } from '../utils/parseSfc';

const plugin: VueLanguagePlugin = () => {

	return {

		version: 1,

		parseSFC(fileName, content) {

			if (fileName.endsWith('.md')) {

				content = content
					// code block
					.replace(/```[\s\S]+?```/g, match => '```' + ' '.repeat(match.length - 6) + '```')
					// inline code block
					.replace(/`[^\n`]+?`/g, match => `\`${' '.repeat(match.length - 2)}\``)
					// # \<script setup>
					.replace(/\\\<[\s\S]+?\>\n?/g, match => ' '.repeat(match.length));

				const sfcBlockReg = /\<(script|style)\b[\s\S]*?\>([\s\S]*?)\<\/\1\>/g;
				const codeGen: Segment[] = [];

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

				const file2VueSourceMap = new SourceMap(buildMappings(codeGen));
				const sfc = parse(toString(codeGen));

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
					block.loc.start.offset = file2VueSourceMap.toSourceOffset(block.loc.start.offset)?.[0] ?? -1;
					block.loc.end.offset = file2VueSourceMap.toSourceOffset(block.loc.end.offset)?.[0] ?? -1;
				}
			};
		}
	};
};
export = plugin;
