import * as vue from '@volar/vue-language-core';
import * as embedded from '@volar/language-core';
import * as CompilerDOM from '@vue/compiler-dom';
import { computed, ComputedRef } from '@vue/reactivity';

import type * as ts from 'typescript/lib/tsserverlibrary';

export function checkTemplateData(
	sourceFile: embedded.EmbeddedLangaugeSourceFile,
	tsLs: ts.LanguageService,
) {

	if (!(sourceFile instanceof vue.VueSourceFile)) {
		return {
			components: [],
			componentItems: [],
		};
	}

	const options: ts.GetCompletionsAtPositionOptions = {
		includeCompletionsWithInsertText: true, // if missing, { 'aaa-bbb': any, ccc: any } type only has result ['ccc']
	};

	let file: embedded.EmbeddedFile | undefined;
	embedded.forEachEmbeddeds(sourceFile.embeddeds, embedded => {
		if (embedded.file.fileName === sourceFile.tsFileName) {
			file = embedded.file;
		}
	});

	if (file && file.codeGen.getText().indexOf(vue.SearchTexts.Components) >= 0) {

		const components = tsLs.getCompletionsAtPosition(
			file.fileName,
			file.codeGen.getText().indexOf(vue.SearchTexts.Components),
			options
		);

		if (components) {

			const items = components.entries
				.filter(entry => entry.kind !== 'warning')
				.filter(entry => entry.name.indexOf('$') === -1 && !entry.name.startsWith('_'));

			const componentNames = items.map(entry => entry.name);

			return {
				components: componentNames,
				componentItems: items,
			};
		}
	}

	return {
		components: [],
		componentItems: [],
	};
}

const map = new WeakMap<embedded.EmbeddedLangaugeSourceFile, ComputedRef>();

export function getTemplateTagsAndAttrs(sourceFile: embedded.EmbeddedLangaugeSourceFile) {

	if (!map.has(sourceFile)) {
		const getter = computed(() => {
			if (!(sourceFile instanceof vue.VueSourceFile))
				return;
			const ast = sourceFile.compiledSFCTemplate?.ast;
			const tags = new Map<string, number[]>();
			const attrs = new Set<string>();
			if (ast) {
				vue.walkElementNodes(ast, node => {

					if (!tags.has(node.tag)) {
						tags.set(node.tag, []);
					}

					const offsets = tags.get(node.tag)!;
					const startTagHtmlOffset = node.loc.start.offset + node.loc.source.indexOf(node.tag);
					const endTagHtmlOffset = node.loc.start.offset + node.loc.source.lastIndexOf(node.tag);

					offsets.push(startTagHtmlOffset);
					offsets.push(endTagHtmlOffset);

					for (const prop of node.props) {
						if (
							prop.type === CompilerDOM.NodeTypes.DIRECTIVE
							&& prop.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
							&& prop.arg.isStatic
						) {
							attrs.add(prop.arg.content);
						}
						else if (
							prop.type === CompilerDOM.NodeTypes.ATTRIBUTE
						) {
							attrs.add(prop.name);
						}
					}
				});
			}
			return {
				tags,
				attrs,
			};
		});
		map.set(sourceFile, getter);
	}

	return map.get(sourceFile)!.value;
}
