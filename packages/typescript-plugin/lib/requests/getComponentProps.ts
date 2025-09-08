import type * as ts from 'typescript';
import { getComponentType, getVariableType } from './utils';

export interface ComponentPropInfo {
	name: string;
	required?: boolean;
	deprecated?: boolean;
	isAttribute?: boolean;
	documentation?: string;
	values?: string[];
}

export function getComponentProps(
	ts: typeof import('typescript'),
	program: ts.Program,
	fileName: string,
	tag: string,
): ComponentPropInfo[] {
	const components = getVariableType(ts, program, fileName, '__VLS_components');
	if (!components) {
		return [];
	}

	const componentType = getComponentType(ts, program, fileName, components, tag);
	if (!componentType) {
		return [];
	}

	const result = new Map<string, ComponentPropInfo>();
	const checker = program.getTypeChecker();

	for (const sig of componentType.getCallSignatures()) {
		if (sig.parameters.length) {
			const propParam = sig.parameters[0]!;
			const propsType = checker.getTypeOfSymbolAtLocation(propParam, components.node);
			const props = propsType.getProperties();
			for (const prop of props) {
				handlePropSymbol(prop);
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
				handlePropSymbol(prop);
			}
		}
	}

	return [...result.values()];

	function handlePropSymbol(prop: ts.Symbol) {
		if (prop.flags & ts.SymbolFlags.Method) { // #2443
			return;
		}
		const name = prop.name;
		const required = !(prop.flags & ts.SymbolFlags.Optional) || undefined;
		const {
			documentation,
			deprecated,
		} = generateDocumentation(prop.getDocumentationComment(checker), prop.getJsDocTags());
		const values: any[] = [];
		const type = checker.getTypeOfSymbol(prop);
		const subTypes: ts.Type[] | undefined = (type as any).types;

		if (subTypes) {
			for (const subType of subTypes) {
				const value = (subType as any).value;
				if (value) {
					values.push(value);
				}
			}
		}

		let isAttribute: boolean | undefined;
		for (const { parent } of checker.getRootSymbols(prop).flatMap(root => root.declarations ?? [])) {
			if (!ts.isInterfaceDeclaration(parent)) {
				continue;
			}
			const { text } = parent.name;
			if (
				text.endsWith('HTMLAttributes')
				|| text === 'AriaAttributes'
				|| text === 'SVGAttributes'
			) {
				isAttribute = true;
				break;
			}
		}

		result.set(name, {
			name,
			required,
			deprecated,
			isAttribute,
			documentation,
			values,
		});
	}
}

function generateDocumentation(parts: ts.SymbolDisplayPart[], jsDocTags: ts.JSDocTagInfo[]) {
	const parsedComment = _symbolDisplayPartsToMarkdown(parts);
	const parsedJsDoc = _jsDocTagInfoToMarkdown(jsDocTags);
	const documentation = [parsedComment, parsedJsDoc].filter(str => !!str).join('\n\n');
	const deprecated = jsDocTags.some(tag => tag.name === 'deprecated');
	return {
		documentation,
		deprecated,
	};
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
			}
			else {
				return t.text;
			}
		}).join('') || '';

		return `${tagName} ${tagText}`;
	}).join('\n\n');
}
