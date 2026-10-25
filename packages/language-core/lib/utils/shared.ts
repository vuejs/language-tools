import * as CompilerDOM from '@vue/compiler-dom';
import { camelize, capitalize, hyphenate } from '@vue/shared';
import * as path from 'path-browserify';
import type * as ts from 'typescript/ast' with { 'resolution-mode': 'import' };
import type { IRTemplate, TextRange, TypeScript } from '../types';

export { hyphenate as hyphenateTag } from '@vue/shared';

export function hyphenateAttr(str: string) {
	let hyphencase = hyphenate(str);
	// fix https://github.com/vuejs/core/issues/8811
	if (str.length && str[0] !== str[0]!.toLowerCase()) {
		hyphencase = '-' + hyphencase;
	}
	return hyphencase;
}

export function normalizeAttributeValue(node: CompilerDOM.TextNode) {
	const { source, start } = node.loc;
	if (
		(source.startsWith('"') && source.endsWith('"'))
		|| (source.startsWith("'") && source.endsWith("'"))
	) {
		return [source.slice(1, -1), start.offset + 1] as const;
	}
	return [source, start.offset] as const;
}

export function getElementTagOffsets(
	node: CompilerDOM.ElementNode,
	template: IRTemplate,
) {
	const tagOffsets = [
		template.content.indexOf(node.tag, node.loc.start.offset),
	];
	if (!node.isSelfClosing && template.lang === 'html') {
		const endTagOffset = node.loc.start.offset + node.loc.source.lastIndexOf(node.tag);
		if (endTagOffset > tagOffsets[0]!) {
			tagOffsets.push(endTagOffset);
		}
	}
	return tagOffsets as [number] | [number, number];
}

/** The `:is` binding of a `<component>` element, which renders the component its expression evaluates to. */
export function getComponentIsBinding(node: CompilerDOM.ElementNode) {
	if (node.tag !== 'component') {
		return;
	}
	for (const prop of node.props) {
		if (
			prop.type === CompilerDOM.NodeTypes.DIRECTIVE
			&& prop.name === 'bind'
			&& prop.arg?.loc.source === 'is'
			&& prop.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
		) {
			return { prop, arg: prop.arg, exp: prop.exp };
		}
	}
}

export function getStartEnd<T extends ts.Node>(
	node: T,
	ast: ts.SourceFile,
): TextRange<T> {
	return {
		node,
		start: node.getStart(ast),
		end: node.end,
	};
}

export function getNodeText(
	node: ts.Node,
	ast: ts.SourceFile,
) {
	const { start, end } = getStartEnd(node, ast);
	return ast.text.slice(start, end);
}

// The type guards below are named differently, or missing, in the TypeScript 7 and classic APIs.

export function isStringLiteralLike(
	ts: TypeScript,
	node: ts.Node,
): node is ts.StringLiteral | ts.NoSubstitutionTemplateLiteral {
	return node.kind === ts.SyntaxKind.StringLiteral || node.kind === ts.SyntaxKind.NoSubstitutionTemplateLiteral;
}

export function isFunctionLikeDeclaration(ts: TypeScript, node: ts.Node): node is ts.FunctionLikeDeclaration {
	switch (node.kind) {
		case ts.SyntaxKind.FunctionDeclaration:
		case ts.SyntaxKind.MethodDeclaration:
		case ts.SyntaxKind.GetAccessor:
		case ts.SyntaxKind.SetAccessor:
		case ts.SyntaxKind.Constructor:
		case ts.SyntaxKind.FunctionExpression:
		case ts.SyntaxKind.ArrowFunction:
			return true;
	}
	return false;
}

export function isTypeAssertionExpression(ts: TypeScript, node: ts.Node): node is ts.TypeAssertion {
	return node.kind === ts.SyntaxKind.TypeAssertionExpression;
}

/** Strips the last extension, as `@vue/compiler-core` does to derive a component's self-reference name. */
export function getBaseNameWithoutExtension(fileName: string) {
	const baseName = path.basename(fileName);
	return baseName.slice(0, baseName.lastIndexOf('.'));
}

/** The name a Vue file's template refers to the file's own component by. */
export function getSelfComponentName(fileName: string) {
	return capitalize(camelize(getBaseNameWithoutExtension(fileName)));
}
