import * as vue from '@vue/language-core';
import { camelize, capitalize } from '@vue/shared';
import type * as ts from 'typescript';
import type { RequestContext } from './types';

export function getComponentProps(
	this: RequestContext,
	fileName: string,
	tag: string,
	requiredOnly = false
) {
	const { typescript: ts, language, languageService, getFileId } = this;
	const volarFile = language.scripts.get(getFileId(fileName));
	if (!(volarFile?.generated?.root instanceof vue.VueVirtualCode)) {
		return;
	}
	const vueCode = volarFile.generated.root;
	const program = languageService.getProgram()!;
	const checker = program.getTypeChecker();
	const components = getVariableType(ts, languageService, vueCode, '__VLS_components');
	if (!components) {
		return [];
	}

	const name = tag.split('.');

	let componentSymbol = components.type.getProperty(name[0]);

	if (!componentSymbol) {
		componentSymbol = components.type.getProperty(camelize(name[0]))
			?? components.type.getProperty(capitalize(camelize(name[0])));
	}

	if (!componentSymbol) {
		return [];
	}

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

	const result = new Map<string, { name: string, commentMarkdown: string; }>();

	for (const sig of componentType.getCallSignatures()) {
		const propParam = sig.parameters[0];
		if (propParam) {
			const propsType = checker.getTypeOfSymbolAtLocation(propParam, components.node);
			const props = propsType.getProperties();
			for (const prop of props) {
				if (!requiredOnly || !(prop.flags & ts.SymbolFlags.Optional)) {
					const name = prop.name;
					const commentMarkdown = generateCommentMarkdown(prop.getDocumentationComment(checker), prop.getJsDocTags());

					result.set(name, { name, commentMarkdown });
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
					const name = prop.name;
					const commentMarkdown = generateCommentMarkdown(prop.getDocumentationComment(checker), prop.getJsDocTags());

					result.set(name, { name, commentMarkdown });
				}
			}
		}
	}

	return [...result.values()];
}

export function getComponentEvents(
	this: RequestContext,
	fileName: string,
	tag: string
) {
	const { typescript: ts, language, languageService, getFileId } = this;
	const volarFile = language.scripts.get(getFileId(fileName));
	if (!(volarFile?.generated?.root instanceof vue.VueVirtualCode)) {
		return;
	}
	const vueCode = volarFile.generated.root;
	const program = languageService.getProgram()!;
	const checker = program.getTypeChecker();
	const components = getVariableType(ts, languageService, vueCode, '__VLS_components');
	if (!components) {
		return [];
	}

	const name = tag.split('.');

	let componentSymbol = components.type.getProperty(name[0]);

	if (!componentSymbol) {
		componentSymbol = components.type.getProperty(camelize(name[0]))
			?? components.type.getProperty(capitalize(camelize(name[0])));
	}

	if (!componentSymbol) {
		return [];
	}

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

export function getTemplateContextProps(
	this: RequestContext,
	fileName: string
) {
	const { typescript: ts, language, languageService, getFileId } = this;
	const volarFile = language.scripts.get(getFileId(fileName));
	if (!(volarFile?.generated?.root instanceof vue.VueVirtualCode)) {
		return;
	}
	const vueCode = volarFile.generated.root;

	return getVariableType(ts, languageService, vueCode, '__VLS_ctx')
		?.type
		?.getProperties()
		.map(c => c.name);
}

export function getComponentNames(
	this: RequestContext,
	fileName: string
) {
	const { typescript: ts, language, languageService, getFileId } = this;
	const volarFile = language.scripts.get(getFileId(fileName));
	if (!(volarFile?.generated?.root instanceof vue.VueVirtualCode)) {
		return;
	}
	const vueCode = volarFile.generated.root;

	return getVariableType(ts, languageService, vueCode, '__VLS_components')
		?.type
		?.getProperties()
		.map(c => c.name)
		.filter(entry => entry.indexOf('$') === -1 && !entry.startsWith('_'))
		?? [];
}

export function _getComponentNames(
	ts: typeof import('typescript'),
	tsLs: ts.LanguageService,
	vueCode: vue.VueVirtualCode
) {
	return getVariableType(ts, tsLs, vueCode, '__VLS_components')
		?.type
		?.getProperties()
		.map(c => c.name)
		.filter(entry => entry.indexOf('$') === -1 && !entry.startsWith('_'))
		?? [];
}

export function getElementAttrs(
	this: RequestContext,
	fileName: string,
	tagName: string
) {
	const { typescript: ts, language, languageService, getFileId } = this;
	const volarFile = language.scripts.get(getFileId(fileName));
	if (!(volarFile?.generated?.root instanceof vue.VueVirtualCode)) {
		return;
	}
	const program = languageService.getProgram()!;

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
	languageService: ts.LanguageService,
	vueCode: vue.VueVirtualCode,
	name: string
) {
	const program = languageService.getProgram()!;

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
	name: string
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

function generateCommentMarkdown(parts: ts.SymbolDisplayPart[], jsDocTags: ts.JSDocTagInfo[]) {
	const parsedComment = _symbolDisplayPartsToMarkdown(parts);
	const parsedJsDoc = _jsDocTagInfoToMarkdown(jsDocTags);
	let result = [parsedComment, parsedJsDoc].filter(str => !!str).join('\n\n');
	return result;
}


function _symbolDisplayPartsToMarkdown(parts: ts.SymbolDisplayPart[]) {
	return parts.map(part => {
		switch (part.kind) {
			case 'keyword':
				return `\`${part.text}\``;
			case 'functionName':
				return `**${part.text}**`;
			default:
				return part.text;
		}
	}).join('');
}


function _jsDocTagInfoToMarkdown(jsDocTags: ts.JSDocTagInfo[]) {
	return jsDocTags.map(tag => {
		const tagName = `*@${tag.name}*`;
		const tagText = tag.text?.map(t => {
			if (t.kind === 'parameterName') {
				return `\`${t.text}\``;
			} else {
				return t.text;
			}
		}).join('') || '';

		return `${tagName} ${tagText}`;
	}).join('\n\n');
}
