import * as embedded from '@volar/language-core';
import type { CompilerDOM } from '@vue/language-core';
import * as vue from '@vue/language-core';
import { camelize, capitalize } from '@vue/shared';
import { computed } from 'computeds';
import type * as ts from 'typescript/lib/tsserverlibrary';

export function getPropsByTag(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	tsLs: ts.LanguageService,
	sourceFile: embedded.VirtualFile,
	tag: string,
	vueCompilerOptions: vue.VueCompilerOptions,
	requiredOnly = false,
) {

	const checker = tsLs.getProgram()!.getTypeChecker();
	const components = getVariableType(ts, tsLs, sourceFile, '__VLS_components');
	if (!components)
		return [];

	const name = tag.split('.');

	let componentSymbol = components.type.getProperty(name[0]);

	if (!componentSymbol && !vueCompilerOptions.nativeTags.includes(name[0])) {
		componentSymbol = components.type.getProperty(camelize(name[0]))
			?? components.type.getProperty(capitalize(camelize(name[0])));
	}

	if (!componentSymbol)
		return [];

	let componentType = checker.getTypeOfSymbolAtLocation(componentSymbol, components.node);

	for (let i = 1; i < name.length; i++) {
		componentSymbol = componentType.getProperty(name[i]);
		if (componentSymbol) {
			componentType = checker.getTypeOfSymbolAtLocation(componentSymbol, components.node);
		}
		else {
			return [];
		}
	}

	const result = new Set<string>();

	for (const sig of componentType.getCallSignatures()) {
		const propParam = sig.parameters[0];
		if (propParam) {
			const propsType = checker.getTypeOfSymbolAtLocation(propParam, components.node);
			const props = propsType.getProperties();
			for (const prop of props) {
				if (!requiredOnly || !(prop.flags & ts.SymbolFlags.Optional)) {
					result.add(prop.name);
				}
			}
		}
	}

	for (const sig of componentType.getConstructSignatures()) {
		const instanceType = sig.getReturnType();
		const propsSymbol = instanceType.getProperty('$props');
		if (propsSymbol) {
			const propsType = checker.getTypeOfSymbolAtLocation(propsSymbol, components.node);
			const props = propsType.getProperties();
			for (const prop of props) {
				if (prop.flags & ts.SymbolFlags.Method) { // #2443
					continue;
				}
				if (!requiredOnly || !(prop.flags & ts.SymbolFlags.Optional)) {
					result.add(prop.name);
				}
			}
		}
	}

	return [...result];
}

export function getEventsOfTag(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	tsLs: ts.LanguageService,
	sourceFile: embedded.VirtualFile,
	tag: string,
	vueCompilerOptions: vue.VueCompilerOptions,
) {

	const checker = tsLs.getProgram()!.getTypeChecker();
	const components = getVariableType(ts, tsLs, sourceFile, '__VLS_components');
	if (!components)
		return [];

	const name = tag.split('.');

	let componentSymbol = components.type.getProperty(name[0]);

	if (!componentSymbol && !vueCompilerOptions.nativeTags.includes(name[0])) {
		componentSymbol = components.type.getProperty(camelize(name[0]))
			?? components.type.getProperty(capitalize(camelize(name[0])));
	}

	if (!componentSymbol)
		return [];

	let componentType = checker.getTypeOfSymbolAtLocation(componentSymbol, components.node);

	for (let i = 1; i < name.length; i++) {
		componentSymbol = componentType.getProperty(name[i]);
		if (componentSymbol) {
			componentType = checker.getTypeOfSymbolAtLocation(componentSymbol, components.node);
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
			const emitType = checker.getTypeOfSymbolAtLocation(emitSymbol, components.node);
			for (const call of emitType.getCallSignatures()) {
				const eventNameParamSymbol = call.parameters[0];
				if (eventNameParamSymbol) {
					const eventNameParamType = checker.getTypeOfSymbolAtLocation(eventNameParamSymbol, components.node);
					if (eventNameParamType.isStringLiteral()) {
						result.add(eventNameParamType.value);
					}
				}
			}
		}
	}

	return [...result];
}

export function getTemplateCtx(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	tsLs: ts.LanguageService,
	sourceFile: embedded.VirtualFile,
) {
	return getVariableType(ts, tsLs, sourceFile, '__VLS_ctx')
		?.type
		?.getProperties()
		.map(c => c.name);
}

export function getComponentNames(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	tsLs: ts.LanguageService,
	sourceFile: embedded.VirtualFile,
	vueCompilerOptions: vue.VueCompilerOptions,
) {
	return getVariableType(ts, tsLs, sourceFile, '__VLS_components')
		?.type
		?.getProperties()
		.map(c => c.name)
		.filter(entry => entry.indexOf('$') === -1 && !entry.startsWith('_'))
		.filter(entry => !vueCompilerOptions.nativeTags.includes(entry))
		?? [];
}

export function getElementAttrs(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	tsLs: ts.LanguageService,
	fileName: string,
	tagName: string,
) {

	let tsSourceFile: ts.SourceFile | undefined;

	if (tsSourceFile = tsLs.getProgram()?.getSourceFile(fileName)) {

		const typeNode = tsSourceFile.statements.find((node): node is ts.TypeAliasDeclaration => ts.isTypeAliasDeclaration(node) && node.name.getText() === '__VLS_IntrinsicElements');
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

function getVariableType(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	tsLs: ts.LanguageService,
	sourceFile: embedded.VirtualFile,
	name: string,
) {

	if (!(sourceFile instanceof vue.VueFile)) {
		return;
	}

	const file = sourceFile.mainTsFile;

	let tsSourceFile: ts.SourceFile | undefined;

	if (file && (tsSourceFile = tsLs.getProgram()?.getSourceFile(file.fileName))) {

		const node = searchVariableDeclarationNode(ts, tsSourceFile, name);
		const checker = tsLs.getProgram()?.getTypeChecker();

		if (checker && node) {
			return {
				node: node,
				type: checker.getTypeAtLocation(node),
			};
		}
	}
}

function searchVariableDeclarationNode(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	sourceFile: ts.SourceFile,
	name: string,
) {

	let componentsNode: ts.Node | undefined;

	walk(sourceFile);

	return componentsNode;

	function walk(node: ts.Node) {
		if (componentsNode) {
			return;
		}
		else if (ts.isVariableDeclaration(node) && node.name.getText() === name) {
			componentsNode = node;
		}
		else {
			node.forEachChild(walk);
		}
	}
}

type Tags = Map<string, {
	offsets: number[];
	attrs: Map<string, {
		offsets: number[];
	}>,
}>;

const map = new WeakMap<embedded.VirtualFile, () => Tags | undefined>();

export function getTemplateTagsAndAttrs(sourceFile: embedded.VirtualFile): Tags {

	if (!map.has(sourceFile)) {
		const getter = computed(() => {
			if (!(sourceFile instanceof vue.VueFile))
				return;
			const ast = sourceFile.sfc.template?.ast;
			const tags: Tags = new Map();
			if (ast) {
				for (const node of vue.eachElementNode(ast)) {

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
							prop.type === 7 satisfies CompilerDOM.NodeTypes.DIRECTIVE
							&& prop.arg?.type === 4 satisfies CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
							&& prop.arg.isStatic
						) {
							name = prop.arg.content;
							offset = prop.arg.loc.start.offset;
						}
						else if (
							prop.type === 6 satisfies CompilerDOM.NodeTypes.ATTRIBUTE
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
				}
			}
			return tags;
		});
		map.set(sourceFile, getter);
	}

	return map.get(sourceFile)!() ?? new Map();
}
