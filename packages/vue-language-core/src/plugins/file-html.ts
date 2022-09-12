import { CodeGen } from '@volar/code-gen';
import { SourceMapBase } from '@volar/source-map';
import { parse, SFCBlock } from '@vue/compiler-sfc';
import { VueLanguagePlugin } from '../types';

const plugin: VueLanguagePlugin = () => {

	return {

		parseSFC(fileName, content) {

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

				const file2VueSourceMap = new SourceMapBase(codeGen.mappings);
				const sfc = parse(codeGen.getText(), { sourceMap: false, ignoreEmpty: false });

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
}
export = plugin;
