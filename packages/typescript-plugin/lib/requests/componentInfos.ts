import * as vue from '@vue/language-core';
import { camelize, capitalize } from '@vue/shared';
import type * as ts from 'typescript';
import { getProject } from '../utils';

export function getComponentProps(fileName: string, tag: string, requiredOnly = false) {
	const match = getProject(fileName);
	if (!match) {
		return;
	}
	const { ts, files, vueOptions } = match;
	const volarFile = files.get(fileName);
	if (!(volarFile?.generated?.code instanceof vue.VueGeneratedCode)) {
		return;
	}
	const vueCode = volarFile.generated.code;
	const tsLs = match.info.languageService;
	const program: ts.Program = (tsLs as any).getCurrentProgram();
	if (!program) {
		return;
	}

	const checker = program.getTypeChecker();
	const components = getVariableType(ts, tsLs, vueCode, '__VLS_components');
	if (!components)
		return [];

	const name = tag.split('.');

	let componentSymbol = components.type.getProperty(name[0]);

	if (!componentSymbol && !vueOptions.nativeTags.includes(name[0])) {
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

export function getComponentEvents(fileName: string, tag: string) {
	const match = getProject(fileName);
	if (!match) {
		return;
	}
	const { ts, files, vueOptions } = match;
	const volarFile = files.get(fileName);
	if (!(volarFile?.generated?.code instanceof vue.VueGeneratedCode)) {
		return;
	}
	const tsLs = match.info.languageService;
	const vueCode = volarFile.generated.code;
	const program: ts.Program = (tsLs as any).getCurrentProgram();
	if (!program) {
		return;
	}

	const checker = program.getTypeChecker();
	const components = getVariableType(ts, tsLs, vueCode, '__VLS_components');
	if (!components)
		return [];

	const name = tag.split('.');

	let componentSymbol = components.type.getProperty(name[0]);

	if (!componentSymbol && !vueOptions.nativeTags.includes(name[0])) {
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

export function getTemplateContextProps(fileName: string) {
	const match = getProject(fileName);
	if (!match) {
		return;
	}
	const { ts, files } = match;
	const volarFile = files.get(fileName);
	if (!(volarFile?.generated?.code instanceof vue.VueGeneratedCode)) {
		return;
	}
	const tsLs = match.info.languageService;
	const vueCode = volarFile.generated.code;

	return getVariableType(ts, tsLs, vueCode, '__VLS_ctx')
		?.type
		?.getProperties()
		.map(c => c.name);
}

export function getComponentNames(fileName: string) {
	const match = getProject(fileName);
	if (!match) {
		return;
	}
	const { ts, files, vueOptions } = match;
	const volarFile = files.get(fileName);
	if (!(volarFile?.generated?.code instanceof vue.VueGeneratedCode)) {
		return;
	}
	const tsLs = match.info.languageService;
	const vueCode = volarFile.generated.code;

	return getVariableType(ts, tsLs, vueCode, '__VLS_components')
		?.type
		?.getProperties()
		.map(c => c.name)
		.filter(entry => entry.indexOf('$') === -1 && !entry.startsWith('_'))
		.filter(entry => !vueOptions.nativeTags.includes(entry))
		?? [];
}

export function getElementAttrs(fileName: string, tagName: string) {
	const match = getProject(fileName);
	if (!match) {
		return;
	}
	const { ts, files } = match;
	const volarFile = files.get(fileName);
	if (!(volarFile?.generated?.code instanceof vue.VueGeneratedCode)) {
		return;
	}
	const tsLs = match.info.languageService;
	const program: ts.Program = (tsLs as any).getCurrentProgram();
	if (!program) {
		return;
	}

	let tsSourceFile: ts.SourceFile | undefined;

	if (tsSourceFile = program.getSourceFile(fileName)) {

		const typeNode = tsSourceFile.statements.find((node): node is ts.TypeAliasDeclaration => ts.isTypeAliasDeclaration(node) && node.name.getText() === '__VLS_IntrinsicElementsCompletion');
		const checker = program.getTypeChecker();

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
	ts: typeof import('typescript'),
	tsLs: ts.LanguageService,
	vueCode: vue.VueGeneratedCode,
	name: string,
) {
	const program: ts.Program = (tsLs as any).getCurrentProgram();
	if (!program) {
		return;
	}

	let tsSourceFile: ts.SourceFile | undefined;

	if (tsSourceFile = program.getSourceFile(vueCode.fileName)) {

		const node = searchVariableDeclarationNode(ts, tsSourceFile, name);
		const checker = program.getTypeChecker();

		if (checker && node) {
			return {
				node: node,
				type: checker.getTypeAtLocation(node),
			};
		}
	}
}

function searchVariableDeclarationNode(
	ts: typeof import('typescript'),
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
