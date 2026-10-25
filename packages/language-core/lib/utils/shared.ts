import * as CompilerDOM from '@vue/compiler-dom';
import { camelize, capitalize, hyphenate, isHTMLTag, isMathMLTag, isSVGTag } from '@vue/shared';
import * as path from 'path-browserify';
import type * as ts from 'typescript/ast' with { 'resolution-mode': 'import' };
import type { DefineModel } from '../parsers/scriptSetupRanges';
import type { IRScriptSetup, IRTemplate, TextRange, TypeScript, VueCompilerOptions } from '../types';

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

/** The name of the static `ref` attribute of an element and the offset of the name in the template. */
export function getTemplateRef(node: CompilerDOM.ElementNode) {
	for (const prop of node.props) {
		if (
			prop.type === CompilerDOM.NodeTypes.ATTRIBUTE
			&& prop.name === 'ref'
			&& prop.value
		) {
			return normalizeAttributeValue(prop.value);
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

/**
 * The prop that an argument-less `v-model` binds, or `undefined` for none, in which case its expression is
 * only checked on its own.
 */
export function getModelPropName(
	node: CompilerDOM.ElementNode,
	vueCompilerOptions: VueCompilerOptions,
): string | undefined {
	const tag = hyphenate(node.tag);
	const isElement = node.tagType === CompilerDOM.ElementTypes.ELEMENT;
	if (
		Object.hasOwn(vueCompilerOptions.vModelPropName, tag)
		// an entry of a native tag does not apply to a component of the same name, e.g. `<Input>`
		&& (isElement || node.tagType === CompilerDOM.ElementTypes.COMPONENT && !isNativeTag(tag))
	) {
		return vueCompilerOptions.vModelPropName[tag] || undefined;
	}
	if (isElement) {
		return getNativeModelPropName(node);
	}
	return 'modelValue';
}

/** The prop that `defineModel` declares in `scriptSetup`. */
export function getDefineModelPropName(scriptSetup: IRScriptSetup, defineModel: DefineModel) {
	return defineModel.name
		? camelize(scriptSetup.content.slice(defineModel.name.start + 1, defineModel.name.end - 1))
		: 'modelValue';
}

// Follows the runtime directive that `transformModel` of `@vue/compiler-dom` picks:
// https://github.com/vuejs/core/blob/v3.5.40/packages/compiler-dom/src/transforms/vModel.ts#L48-L100
// `vModelText` writes `el.value`; the value of `vModelCheckbox` may be an array, a `Set` or a
// `true-value`, `vModelRadio` compares with `:value`, and `vModelDynamic` picks one of them at runtime,
// so those bind no prop.
function getNativeModelPropName(node: CompilerDOM.ElementNode): string | undefined {
	switch (node.tag) {
		case 'textarea':
		case 'select':
			return 'value';
		case 'input': {
			const type = CompilerDOM.findProp(node, 'type');
			if (type) {
				if (type.type === CompilerDOM.NodeTypes.DIRECTIVE) {
					return;
				}
				switch (type.value?.content) {
					case 'radio':
					case 'checkbox':
					case 'file':
						return;
				}
				return 'value';
			}
			return CompilerDOM.hasDynamicKeyVBind(node) ? undefined : 'value';
		}
	}
	// `@vue/compiler-dom` rejects `v-model` on other elements
	return 'modelValue';
}

function isNativeTag(tag: string) {
	return isHTMLTag(tag) || isSVGTag(tag) || isMathMLTag(tag);
}
