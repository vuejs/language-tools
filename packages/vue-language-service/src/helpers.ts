import * as vue from '@volar/vue-language-core';
import * as embedded from '@volar/language-core';
import * as CompilerDOM from '@vue/compiler-dom';
import { computed, ComputedRef } from '@vue/reactivity';
import { typesFileName } from '@volar/vue-language-core/out/utils/localTypes';

import type * as ts from 'typescript/lib/tsserverlibrary';

export function checkComponentNames(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	tsLs: ts.LanguageService,
	sourceFile: embedded.SourceFile,
) {

	if (!(sourceFile instanceof vue.VueSourceFile)) {
		return [];
	}

	let file: embedded.SourceFile | undefined;
	let tsSourceFile: ts.SourceFile | undefined;

	embedded.forEachEmbeddeds(sourceFile.embeddeds, embedded => {
		if (embedded.fileName === sourceFile.tsFileName) {
			file = embedded;
		}
	});

	if (file && (tsSourceFile = tsLs.getProgram()?.getSourceFile(file.fileName))) {

		const componentsNode = getComponentsNode(ts, tsSourceFile);
		const checker = tsLs.getProgram()?.getTypeChecker();

		if (checker && componentsNode) {

			const type = checker.getTypeAtLocation(componentsNode);
			const components = type.getProperties();

			return components
				.map(c => c.name)
				.filter(entry => entry.indexOf('$') === -1 && !entry.startsWith('_'));
		}
	}

	return [];

	function getComponentsNode(
		ts: typeof import('typescript/lib/tsserverlibrary'),
		sourceFile: ts.SourceFile,
	) {

		let componentsNode: ts.Node | undefined;

		walk(sourceFile);

		return componentsNode;

		function walk(node: ts.Node) {
			if (componentsNode) {
				return;
			}
			else if (ts.isVariableDeclaration(node) && node.name.getText() === '__VLS_components') {
				componentsNode = node;
			}
			else {
				node.forEachChild(walk);
			}
		}
	}
}

export function checkGlobalAttrs(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	tsLs: ts.LanguageService,
	fileName: string,
) {

	const sharedTypesFileName = fileName.substring(0, fileName.lastIndexOf('/')) + '/' + typesFileName;

	let tsSourceFile: ts.SourceFile | undefined;

	if (tsSourceFile = tsLs.getProgram()?.getSourceFile(sharedTypesFileName)) {

		const typeNoe = tsSourceFile.statements.find((node): node is ts.TypeAliasDeclaration => ts.isTypeAliasDeclaration(node) && node.name.getText() === 'GlobalAttrs');
		const checker = tsLs.getProgram()?.getTypeChecker();

		if (checker && typeNoe) {
			checker.getTypeFromTypeNode;

			const type = checker.getTypeFromTypeNode(typeNoe.type);
			const attrs = type.getProperties();

			console.log(attrs.map(c => c.name));

			return attrs.map(c => c.name);
		}
	}

	return [];
}

const map = new WeakMap<embedded.SourceFile, ComputedRef<{
	tags: Map<string, number[]>;
	attrs: Set<string>;
} | undefined>>();

export function getTemplateTagsAndAttrs(sourceFile: embedded.SourceFile) {

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

	return map.get(sourceFile)!.value ?? {
		tags: new Map<string, number[]>(),
		attrs: new Set<string>(),
	};
}
