import * as vue from '@volar/vue-language-core';
import * as embedded from '@volar/language-core';
import * as CompilerDOM from '@vue/compiler-dom';
import { computed, ComputedRef } from '@vue/reactivity';
import { typesFileName } from '@volar/vue-language-core/out/utils/localTypes';
import { camelize, capitalize } from '@vue/shared';

import type * as ts from 'typescript/lib/tsserverlibrary';

export function checkPropsOfTag(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	tsLs: ts.LanguageService,
	sourceFile: embedded.VirtualFile,
	tag: string,
) {

	const checker = tsLs.getProgram()!.getTypeChecker();
	const components = getComponentsType(ts, tsLs, sourceFile);
	if (!components)
		return [];

	const links = tag.split('.');
	let componentSymbol = components.componentsType.getProperty(links[0])
		?? components.componentsType.getProperty(camelize(links[0]))
		?? components.componentsType.getProperty(capitalize(camelize(links[0])));

	if (!componentSymbol)
		return [];

	let componentType = checker.getTypeOfSymbolAtLocation(componentSymbol, components.componentsNode);

	for (let i = 1; i < links.length; i++) {
		componentSymbol = componentType.getProperty(links[i]);
		if (componentSymbol) {
			componentType = checker.getTypeOfSymbolAtLocation(componentSymbol, components.componentsNode);
		}
		else {
			return [];
		}
	}

	const result = new Set<string>();

	for (const sig of componentType.getCallSignatures()) {
		const propParam = sig.parameters[0];
		if (propParam) {
			const propsType = checker.getTypeOfSymbolAtLocation(propParam, components.componentsNode);
			const props = propsType.getProperties();
			for (const prop of props) {
				result.add(prop.name);
			}
		}
	}

	for (const sig of componentType.getConstructSignatures()) {
		const instanceType = sig.getReturnType();
		const propsSymbol = instanceType.getProperty('$props');
		if (propsSymbol) {
			const propsType = checker.getTypeOfSymbolAtLocation(propsSymbol, components.componentsNode);
			const props = propsType.getProperties();
			for (const prop of props) {
				result.add(prop.name);
			}
		}
	}

	return [...result];
}

export function checkEventsOfTag(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	tsLs: ts.LanguageService,
	sourceFile: embedded.VirtualFile,
	tag: string,
) {

	const checker = tsLs.getProgram()!.getTypeChecker();
	const components = getComponentsType(ts, tsLs, sourceFile);
	if (!components)
		return [];

	const links = tag.split('.');
	let componentSymbol = components.componentsType.getProperty(links[0])
		?? components.componentsType.getProperty(camelize(links[0]))
		?? components.componentsType.getProperty(capitalize(camelize(links[0])));

	if (!componentSymbol)
		return [];

	let componentType = checker.getTypeOfSymbolAtLocation(componentSymbol, components.componentsNode);

	for (let i = 1; i < links.length; i++) {
		componentSymbol = componentType.getProperty(links[i]);
		if (componentSymbol) {
			componentType = checker.getTypeOfSymbolAtLocation(componentSymbol, components.componentsNode);
		}
		else {
			return [];
		}
	}

	const result = new Set<string>();

	// for (const sig of componentType.getCallSignatures()) {
	// 	const emitParam = sig.parameters[1];
	// 	if (emitParam) {
	// 		// TODO
	// 	}
	// }

	for (const sig of componentType.getConstructSignatures()) {
		const instanceType = sig.getReturnType();
		const emitSymbol = instanceType.getProperty('$emit');
		if (emitSymbol) {
			const emitType = checker.getTypeOfSymbolAtLocation(emitSymbol, components.componentsNode);
			for (const call of emitType.getCallSignatures()) {
				const eventNameParamSymbol = call.parameters[0];
				if (eventNameParamSymbol) {
					const eventNameParamType = checker.getTypeOfSymbolAtLocation(eventNameParamSymbol, components.componentsNode);
					if (eventNameParamType.isStringLiteral()) {
						result.add(eventNameParamType.value);
					}
				}
			}
		}
	}

	return [...result];
}

export function checkComponentNames(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	tsLs: ts.LanguageService,
	sourceFile: embedded.VirtualFile,
) {
	return getComponentsType(ts, tsLs, sourceFile)
		?.componentsType
		?.getProperties()
		.map(c => c.name)
		.filter(entry => entry.indexOf('$') === -1 && !entry.startsWith('_'))
		?? [];
}

export function getElementAttrs(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	tsLs: ts.LanguageService,
	fileName: string,
	tagName: string,
) {

	const sharedTypesFileName = fileName.substring(0, fileName.lastIndexOf('/')) + '/' + typesFileName;

	let tsSourceFile: ts.SourceFile | undefined;

	if (tsSourceFile = tsLs.getProgram()?.getSourceFile(sharedTypesFileName)) {

		const typeNode = tsSourceFile.statements.find((node): node is ts.TypeAliasDeclaration => ts.isTypeAliasDeclaration(node) && node.name.getText() === 'IntrinsicElements');
		const checker = tsLs.getProgram()?.getTypeChecker();

		if (checker && typeNode) {

			const type = checker.getTypeFromTypeNode(typeNode.type);
			const el = type.getProperty(tagName);

			if (el) {
				const attrs = checker.getTypeOfSymbolAtLocation(el, typeNode).getProperties();

				return attrs.map(c => c.name);
			}
		}
	}

	return [];
}

function getComponentsType(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	tsLs: ts.LanguageService,
	sourceFile: embedded.VirtualFile,
) {

	if (!(sourceFile instanceof vue.VueFile)) {
		return;
	}

	let file: embedded.VirtualFile | undefined;
	let tsSourceFile: ts.SourceFile | undefined;

	embedded.forEachEmbeddedFile(sourceFile, embedded => {
		if (embedded.fileName === sourceFile.tsFileName) {
			file = embedded;
		}
	});

	if (file && (tsSourceFile = tsLs.getProgram()?.getSourceFile(file.fileName))) {

		const componentsNode = getComponentsNode(ts, tsSourceFile);
		const checker = tsLs.getProgram()?.getTypeChecker();

		if (checker && componentsNode) {
			return {
				componentsNode,
				componentsType: checker.getTypeAtLocation(componentsNode),
			};
		}
	}

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

type Tags = Map<string, {
	offsets: number[];
	attrs: Map<string, {
		offsets: number[];
	}>,
}>;

const map = new WeakMap<embedded.VirtualFile, ComputedRef<Tags | undefined>>();

export function getTemplateTagsAndAttrs(sourceFile: embedded.VirtualFile): Tags {

	if (!map.has(sourceFile)) {
		const getter = computed(() => {
			if (!(sourceFile instanceof vue.VueFile))
				return;
			const ast = sourceFile.compiledSFCTemplate?.ast;
			const tags: Tags = new Map();
			if (ast) {
				vue.walkElementNodes(ast, node => {

					if (!tags.has(node.tag)) {
						tags.set(node.tag, { offsets: [], attrs: new Map() });
					}

					const tag = tags.get(node.tag)!;
					const startTagHtmlOffset = node.loc.start.offset + node.loc.source.indexOf(node.tag);
					const endTagHtmlOffset = node.loc.start.offset + node.loc.source.lastIndexOf(node.tag);

					tag.offsets.push(startTagHtmlOffset);
					if (!node.isSelfClosing) {
						tag.offsets.push(endTagHtmlOffset);
					}

					for (const prop of node.props) {

						let name: string | undefined;
						let offset: number | undefined;

						if (
							prop.type === CompilerDOM.NodeTypes.DIRECTIVE
							&& prop.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
							&& prop.arg.isStatic
						) {
							name = prop.arg.content;
							offset = prop.arg.loc.start.offset;
						}
						else if (
							prop.type === CompilerDOM.NodeTypes.ATTRIBUTE
						) {
							name = prop.name;
							offset = prop.loc.start.offset;
						}

						if (name !== undefined && offset !== undefined) {
							if (!tag.attrs.has(name)) {
								tag.attrs.set(name, { offsets: [] });
							}
							tag.attrs.get(name)!.offsets.push(offset);
						}
					}
				});
			}
			return tags;
		});
		map.set(sourceFile, getter);
	}

	return map.get(sourceFile)!.value ?? new Map();
}
