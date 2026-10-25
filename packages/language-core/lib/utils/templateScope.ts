import * as CompilerDOM from '@vue/compiler-dom';
import { camelize, capitalize, isBuiltInDirective } from '@vue/shared';
import type * as ts from 'typescript/ast' with { 'resolution-mode': 'import' };
import type { IR, IRBlock, IRTemplate, TypeScript, VueCompilerOptions } from '../types';
import {
	type ExpressionScope,
	forEachDeclarations,
	isLiteralWhitelisted,
	shouldIdentifierSkipped,
} from './bindingReferences';
import { collectBindingNames } from './collectBindings';
import {
	getComponentIsBinding,
	getElementTagOffsets,
	getModelPropName,
	getNodeText,
	getStartEnd,
	getTemplateRef,
	normalizeAttributeValue,
} from './shared';
import {
	collectDefaultInitializers,
	isCompoundExpression,
	parseInterpolationNode,
	parseVForNode,
} from './templateExpressions';
import { getTypeScriptAST } from './typescriptAST';

export interface InlayHintInfo {
	blockName: string;
	offset: number;
	setting: string;
	label: string;
	tooltip?: string;
	paddingRight?: boolean;
	paddingLeft?: boolean;
}

/** A reference of the template to a name that the template context, not a setup binding, provides. */
export interface ContextAccess {
	name: string;
	/** The offset of the name in the template's content. */
	offset: number;
	/** Whether the reference is an operand of an assignment, update or other binary expression. */
	model: boolean;
}

export interface TemplateScopeOptions {
	vueCompilerOptions: VueCompilerOptions;
	setupBindings: Set<string>;
	setupConsts: Set<string>;
	setupRefs: Set<string>;
	hasDefineSlots: boolean;
	propsAssignName: string | undefined;
	slotsAssignName: string | undefined;
}

export const directiveCommentRE = /^<!--\s*@vue-(?<name>[-\w]+)\b(?<content>[\s\S]*)-->$/;

const identifierRE = /^[a-zA-Z_$][0-9a-zA-Z_$]*$/;

class Scope extends Set<string> implements ExpressionScope {
	isBlock = false;
	scopes: Scope[] = [];

	declare(...names: string[]) {
		for (const name of names) {
			this.add(name);
		}
	}

	end() {
		this.scopes.pop();
	}
}

/**
 * The names that the template and the style `v-bind()`s reference as members of the template scope, in the
 * order the TypeScript code generation of `@vue/content-mapper` first lists them, the template's references to
 * the template context, and the inlay hints of the template. The traversal follows that code generation, which
 * lists a name once a template block scope (the template, a `v-for`, a slot, an inline handler) reads it.
 */
export function collectTemplateScope(ts: TypeScript, ir: IR, options: TemplateScopeOptions) {
	const { vueCompilerOptions, setupBindings, setupConsts, setupRefs, hasDefineSlots } = options;
	const templateNames = new Set<string>();
	const styleNames = new Set<string>();
	const contextAccesses: ContextAccess[] = [];
	const inlayHints: InlayHintInfo[] = [];

	let names = templateNames;
	const scopes: Scope[] = [];
	const ctx = { scopes, scope: () => openScope(false) };
	const dollarVars = new Set<string>();
	const commentBuffer: CompilerDOM.CommentNode[] = [];
	const slotNames: (readonly [name: string, offset: number])[] = [];
	const templateRefNames: (readonly [name: string, offset: number])[] = [];
	let components = 0;

	if (!vueCompilerOptions.skipTemplateCodegen && ir.template) {
		const template = ir.template;
		const isVapor = vueCompilerOptions.vapor || !!(ir.scriptSetup?.attrs.vapor || template.attrs.vapor);
		const scope = openScope(true);
		if (options.slotsAssignName) {
			scope.declare(options.slotsAssignName);
		}
		if (options.propsAssignName) {
			scope.declare(options.propsAssignName);
		}
		if (vueCompilerOptions.inferTemplateDollarSlots) {
			dollarVars.add('$slots');
		}
		if (vueCompilerOptions.inferTemplateDollarAttrs) {
			dollarVars.add('$attrs');
		}
		if (vueCompilerOptions.inferTemplateDollarRefs) {
			dollarVars.add('$refs');
		}
		if (vueCompilerOptions.inferTemplateDollarEl) {
			dollarVars.add('$el');
		}
		if (template.ast) {
			visitTemplateChild(template, isVapor, template.ast);
		}
		if (!hasDefineSlots) {
			for (const [name, offset] of slotNames) {
				visitObjectProperty(template, name, offset);
			}
		}
		if (
			vueCompilerOptions.inferTemplateDollarRefs
			|| vueCompilerOptions.inferComponentDollarRefs
			|| setupRefs.size
		) {
			for (const [name, offset] of templateRefNames) {
				visitObjectProperty(template, name, offset);
			}
		}
		scope.end();
	}

	if (ir.styles.length) {
		names = styleNames;
		const scope = openScope(true);
		for (const style of ir.styles) {
			for (const binding of style.bindings) {
				visitInterpolation(style, binding.text, binding.offset, `(`, `)`);
			}
		}
		scope.end();
	}

	return { templateNames, styleNames, contextAccesses, inlayHints };

	function openScope(isBlock: boolean) {
		const scope = new Scope();
		scope.isBlock = isBlock;
		scope.scopes = scopes;
		scopes.push(scope);
		return scope;
	}

	/** A block scope lists the name, unless a local of the expression around it declares the name. */
	function record(name: string) {
		if (isLiteralWhitelisted(name) || name === 'require' || name.startsWith('__VLS_')) {
			return;
		}
		for (let i = scopes.length - 1; i >= 0; i--) {
			const scope = scopes[i]!;
			if (scope.isBlock) {
				names.add(name);
				return;
			}
			if (scope.has(name)) {
				return;
			}
		}
	}

	/** `isWriteBack`: the code generation assigns to the expression, like the update of a `v-model`. */
	function visitInterpolation(
		block: IRBlock,
		code: string,
		start: number,
		prefix = '',
		suffix = '',
		isWriteBack = false,
	) {
		if (identifierRE.test(code)) {
			record(code);
			if (!shouldIdentifierSkipped(ctx, code)) {
				visitContextAccess(block, code, start, isWriteBack);
			}
			return;
		}
		const scope = ctx.scope();
		const ast = getTypeScriptAST(ts, block, prefix + code + suffix);
		let operands: Set<ts.Node> | undefined;
		for (const { id, skipped } of forEachDeclarations(ts, ast, ast, ctx, scope, false)) {
			const name = getNodeText(id, ast);
			record(name);
			if (!skipped) {
				operands ??= collectOperands(ts, ast);
				visitContextAccess(block, name, start + id.getStart(ast) - prefix.length, operands.has(id));
			}
		}
		scope.end();
	}

	/** An identifier the code generation references outside of an expression, like a component tag. */
	function visitIdentifier(block: IRBlock, name: string, start: number) {
		if (setupConsts.has(name) || shouldIdentifierSkipped(ctx, name) || setupRefs.has(name)) {
			return;
		}
		if (setupBindings.has(name) || !dollarVars.has(name)) {
			record(name);
		}
		visitContextAccess(block, name, start, false);
	}

	function visitContextAccess(block: IRBlock, name: string, offset: number, model: boolean) {
		if (
			block === ir.template
			&& !setupConsts.has(name)
			&& !setupRefs.has(name)
			&& !setupBindings.has(name)
			&& !dollarVars.has(name)
		) {
			contextAccesses.push({ name, offset, model });
		}
	}

	function visitObjectProperty(template: IRTemplate, code: string, start: number, shouldBeConstant = false) {
		if (code.startsWith('[') && code.endsWith(']')) {
			if (shouldBeConstant) {
				visitInterpolation(template, code.slice(1, -1), start + 1, `[__VLS_tryAsConstant(`, `)]`);
			}
			else {
				visitInterpolation(template, code, start);
			}
		}
	}

	function visitPropertyAccess(template: IRTemplate, code: string, start: number) {
		if (code.startsWith('[') && code.endsWith(']')) {
			visitInterpolation(template, code, start);
		}
	}

	function enter(node: CompilerDOM.RootNode | CompilerDOM.TemplateChildNode | CompilerDOM.SimpleExpressionNode) {
		if (node.type === CompilerDOM.NodeTypes.COMMENT) {
			commentBuffer.push(node);
			return false;
		}
		const comments = commentBuffer.splice(0);
		return !comments.some(comment => comment.loc.source.match(directiveCommentRE)?.groups!.name === 'skip');
	}

	function visitTemplateChild(
		template: IRTemplate,
		isVapor: boolean,
		node: CompilerDOM.RootNode | CompilerDOM.TemplateChildNode | CompilerDOM.SimpleExpressionNode,
		enterNode = true,
		treatTemplateAsFragment = false,
	) {
		if (enterNode && !enter(node)) {
			return;
		}
		if (node.type === CompilerDOM.NodeTypes.ROOT) {
			for (const child of node.children) {
				visitTemplateChild(template, isVapor, child);
			}
		}
		else if (node.type === CompilerDOM.NodeTypes.ELEMENT) {
			if (node.tagType === CompilerDOM.ElementTypes.SLOT) {
				visitSlotOutlet(template, isVapor, node);
			}
			else {
				const slotDir = node.props.find(CompilerDOM.isVSlot);
				if (node.tagType === CompilerDOM.ElementTypes.TEMPLATE && components && slotDir) {
					visitVSlot(template, isVapor, node, slotDir);
				}
				else if (node.tagType === CompilerDOM.ElementTypes.TEMPLATE && treatTemplateAsFragment) {
					visitFragment(template, isVapor, node);
				}
				else if (node.tagType === CompilerDOM.ElementTypes.COMPONENT) {
					visitComponent(template, isVapor, node);
				}
				else {
					visitElement(template, isVapor, node);
				}
			}
		}
		else if (node.type === CompilerDOM.NodeTypes.COMPOUND_EXPRESSION) {
			for (const child of node.children) {
				if (typeof child === 'object') {
					visitTemplateChild(template, isVapor, child, false);
				}
			}
		}
		else if (node.type === CompilerDOM.NodeTypes.INTERPOLATION) {
			const [content, start] = parseInterpolationNode(node, template.content);
			visitInterpolation(template, content, start, `(`, `);\n`);
		}
		else if (node.type === CompilerDOM.NodeTypes.IF) {
			for (let i = 0; i < node.branches.length; i++) {
				const branch = node.branches[i]!;
				if (branch.condition?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
					visitInterpolation(
						template,
						branch.condition.content,
						branch.condition.loc.start.offset,
						`(`,
						`)`,
					);
				}
				for (const child of branch.children) {
					visitTemplateChild(template, isVapor, child, i !== 0, true);
				}
			}
		}
		else if (node.type === CompilerDOM.NodeTypes.FOR) {
			visitVFor(template, isVapor, node);
		}
		if (enterNode) {
			commentBuffer.length = 0;
		}
	}

	function visitComponent(template: IRTemplate, isVapor: boolean, node: CompilerDOM.ElementNode) {
		let { tag, props } = node;
		let [tagOffset] = getElementTagOffsets(node, template);
		let isExpression = false;
		if (tag.includes('.')) {
			isExpression = true;
		}
		else {
			const isBinding = getComponentIsBinding(node);
			if (isBinding) {
				const { prop, arg, exp } = isBinding;
				if (arg.loc.end.offset === exp.loc.end.offset) {
					inlayHints.push(createVBindShorthandInlayHintInfo(exp.loc, 'is'));
				}
				isExpression = true;
				tag = exp.content;
				tagOffset = exp.loc.start.offset;
				props = props.filter(p => p !== prop);
			}
		}
		if (isExpression) {
			visitInterpolation(template, tag, tagOffset, `(`, `)`);
		}
		else {
			const originalNames = new Set([capitalize(camelize(tag)), camelize(tag), tag]);
			const matchedBinding = [...originalNames].find(name => setupBindings.has(name));
			if (matchedBinding) {
				visitIdentifier(template, matchedBinding, tagOffset);
			}
		}

		components++;
		visitElementProps(template, node, props, true);
		visitElementEvents(template, node);
		visitElementDirectives(template, isVapor, node);
		const templateRef = getTemplateRef(node);
		if (templateRef) {
			templateRefNames.push(templateRef);
		}
		const slotDir = node.props.find(CompilerDOM.isVSlot);
		if (slotDir || node.children.length) {
			visitVSlot(template, isVapor, node, slotDir);
		}
		components--;
	}

	function visitElement(template: IRTemplate, isVapor: boolean, node: CompilerDOM.ElementNode) {
		visitPropertyAccess(template, node.tag, getElementTagOffsets(node, template)[0]);
		visitElementProps(template, node, node.props, true);
		visitElementDirectives(template, isVapor, node);
		const templateRef = getTemplateRef(node);
		if (templateRef) {
			templateRefNames.push(templateRef);
		}
		for (const child of node.children) {
			visitTemplateChild(template, isVapor, child);
		}
	}

	function visitFragment(template: IRTemplate, isVapor: boolean, node: CompilerDOM.ElementNode) {
		if (node.props.length) {
			visitElementProps(template, node, node.props, true);
		}
		for (const child of node.children) {
			visitTemplateChild(template, isVapor, child);
		}
	}

	function visitSlotOutlet(template: IRTemplate, isVapor: boolean, node: CompilerDOM.ElementNode) {
		const nameProp = node.props.find(prop => {
			if (prop.type === CompilerDOM.NodeTypes.ATTRIBUTE) {
				return prop.name === 'name';
			}
			if (prop.name === 'bind' && prop.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
				return prop.arg.content === 'name';
			}
		});
		const props = node.props.filter(prop => prop !== nameProp);
		if (hasDefineSlots) {
			if (nameProp?.type === CompilerDOM.NodeTypes.ATTRIBUTE && nameProp.value) {
				visitPropertyAccess(template, ...normalizeAttributeValue(nameProp.value));
			}
			else if (
				nameProp?.type === CompilerDOM.NodeTypes.DIRECTIVE
				&& nameProp.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
			) {
				visitPropExp(template, nameProp, nameProp.exp);
			}
			visitElementProps(template, node, props, false);
		}
		else {
			visitElementProps(template, node, props, false);
			if (nameProp?.type === CompilerDOM.NodeTypes.ATTRIBUTE && nameProp.value) {
				slotNames.push([
					nameProp.value.content,
					nameProp.loc.start.offset + nameProp.loc.source.indexOf(nameProp.value.content, nameProp.name.length),
				]);
			}
			else if (
				nameProp?.type === CompilerDOM.NodeTypes.DIRECTIVE
				&& nameProp.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
			) {
				if (nameProp.arg?.loc.start.offset === nameProp.exp.loc.start.offset) {
					inlayHints.push(createVBindShorthandInlayHintInfo(nameProp.exp.loc, 'name'));
				}
				visitInterpolation(template, nameProp.exp.content, nameProp.exp.loc.start.offset);
			}
		}
		for (const child of node.children) {
			visitTemplateChild(template, isVapor, child);
		}
	}

	function visitVSlot(
		template: IRTemplate,
		isVapor: boolean,
		node: CompilerDOM.ElementNode,
		slotDir: CompilerDOM.DirectiveNode | undefined,
	) {
		if (slotDir?.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION && slotDir.arg.content) {
			visitObjectProperty(template, slotDir.arg.loc.source, slotDir.arg.loc.start.offset, true);
		}
		const scope = openScope(true);
		if (slotDir?.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
			const slotAst = getTypeScriptAST(ts, template, `(${slotDir.exp.content}) => {}`);
			const statement = slotAst.statements[0];
			if (statement && ts.isExpressionStatement(statement) && ts.isArrowFunction(statement.expression)) {
				visitInterpolation(template, slotAst.text, slotDir.exp.loc.start.offset - 1);
			}
			scope.declare(...collectBindingNames(ts, slotAst, slotAst));
		}
		for (const child of node.children) {
			visitTemplateChild(template, isVapor, child);
		}
		scope.end();
	}

	function visitVFor(template: IRTemplate, isVapor: boolean, node: CompilerDOM.ForNode) {
		const { source } = node.parseResult;
		const { leftExpressionRange, leftExpressionText } = parseVForNode(node);
		let bindingNames: string[] = [];
		const defaultInitializerRanges: [number, number][] = [];
		if (leftExpressionRange && leftExpressionText) {
			const wrap = `const [`;
			const collectAst = getTypeScriptAST(ts, template, `${wrap}${leftExpressionText}]`);
			bindingNames = collectBindingNames(ts, collectAst, collectAst);
			const declaration = (collectAst.statements[0] as ts.VariableStatement).declarationList.declarations[0]!;
			const initializers: ts.Expression[] = [];
			collectDefaultInitializers(ts, declaration.name, initializers);
			for (const initializer of initializers) {
				const { start, end } = getStartEnd(initializer, collectAst);
				defaultInitializerRanges.push([start - wrap.length, end - wrap.length]);
			}
			defaultInitializerRanges.sort((a, b) => a[0] - b[0]);
		}
		if (source.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
			visitInterpolation(template, source.content, source.loc.start.offset, `(`, `)`);
		}
		const scope = openScope(true);
		scope.declare(...bindingNames);
		for (const [start, end] of defaultInitializerRanges) {
			visitInterpolation(template, leftExpressionText!.slice(start, end), leftExpressionRange!.start + start);
		}
		for (const child of node.children) {
			visitTemplateChild(template, isVapor, child, false, true);
		}
		scope.end();
	}

	function visitElementProps(
		template: IRTemplate,
		node: CompilerDOM.ElementNode,
		props: CompilerDOM.ElementNode['props'],
		withFailedExpressions: boolean,
	) {
		const isComponent = node.tagType === CompilerDOM.ElementTypes.COMPONENT;
		const failedExpressions: [CompilerDOM.SimpleExpressionNode, prefix: string, suffix: string][] = [];

		for (const prop of props) {
			if (prop.type === CompilerDOM.NodeTypes.DIRECTIVE && prop.name === 'on') {
				if (
					prop.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
					&& !prop.arg.loc.source.startsWith('[')
					&& !prop.arg.loc.source.endsWith(']')
				) {
					if (!isComponent) {
						visitEventExpression(template, prop);
					}
				}
				else if (
					prop.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
					&& prop.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
					&& prop.arg.loc.source.startsWith('[')
					&& prop.arg.loc.source.endsWith(']')
				) {
					failedExpressions.push([prop.arg, `(`, `)`], [prop.exp, `() => {`, `}`]);
				}
				else if (!prop.arg && prop.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
					failedExpressions.push([prop.exp, `(`, `)`]);
				}
			}
		}

		for (const prop of props) {
			if (
				prop.type === CompilerDOM.NodeTypes.DIRECTIVE
				&& (
					(prop.name === 'bind' && prop.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION)
					|| prop.name === 'model'
				)
				&& (!prop.exp || prop.exp.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION)
			) {
				let propName: string | undefined;
				if (prop.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
					propName = prop.arg.constType === CompilerDOM.ConstantTypes.CAN_STRINGIFY
						? prop.arg.content
						: prop.arg.loc.source;
				}
				else {
					propName = getModelPropName(node, vueCompilerOptions);
				}
				if (propName === undefined || vueCompilerOptions.isDataAttribute(propName)) {
					if (prop.exp && prop.exp.constType !== CompilerDOM.ConstantTypes.CAN_STRINGIFY) {
						failedExpressions.push([prop.exp, `(`, `)`]);
					}
					continue;
				}
				if (prop.name === 'bind' && prop.modifiers.some(m => m.content === 'prop' || m.content === 'attr')) {
					propName = propName.slice(1);
				}
				if (prop.arg) {
					visitObjectProperty(template, propName, prop.arg.loc.start.offset);
				}
				visitPropExp(template, prop, prop.exp);
				if (isComponent && prop.name === 'model') {
					for (const modifier of prop.modifiers) {
						visitObjectProperty(template, modifier.content, modifier.loc.start.offset);
					}
				}
			}
			else if (prop.type === CompilerDOM.NodeTypes.ATTRIBUTE) {
				if (vueCompilerOptions.isDataAttribute(prop.name)) {
					continue;
				}
				const prefix = template.content.slice(prop.loc.start.offset, prop.loc.start.offset + 1);
				if (prefix !== '.' && prefix !== '#') {
					visitObjectProperty(template, prop.name, prop.loc.start.offset);
				}
			}
			else if (
				prop.name === 'bind'
				&& !prop.arg
				&& prop.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
			) {
				if (prop.exp.loc.source === '$attrs') {
					failedExpressions.push([prop.exp, `(`, `)`]);
				}
				else {
					visitPropExp(template, prop, prop.exp);
				}
			}
		}

		if (withFailedExpressions) {
			for (const [exp, prefix, suffix] of failedExpressions) {
				visitInterpolation(template, exp.loc.source, exp.loc.start.offset, prefix, suffix);
			}
		}
	}

	function visitPropExp(
		template: IRTemplate,
		prop: CompilerDOM.DirectiveNode,
		exp: CompilerDOM.SimpleExpressionNode | undefined,
	) {
		if (!exp) {
			return;
		}
		if (prop.arg?.loc.start.offset !== prop.exp?.loc.start.offset) {
			visitInterpolation(template, exp.loc.source, exp.loc.start.offset, `(`, `)`);
		}
		else {
			const propVariableName = camelize(exp.loc.source);
			if (identifierRE.test(propVariableName)) {
				visitIdentifier(template, propVariableName, exp.loc.start.offset);
				inlayHints.push(createVBindShorthandInlayHintInfo(prop.loc, propVariableName));
			}
		}
	}

	function visitElementEvents(template: IRTemplate, node: CompilerDOM.ElementNode) {
		const definitions = new Map<string, CompilerDOM.DirectiveNode[]>();
		const writeBacks: CompilerDOM.DirectiveNode[] = [];
		for (const prop of node.props) {
			if (prop.type === CompilerDOM.NodeTypes.DIRECTIVE && prop.name === 'model' && !prop.arg) {
				const propName = getModelPropName(node, vueCompilerOptions);
				if (propName !== undefined && propName !== 'modelValue') {
					writeBacks.push(prop);
					continue;
				}
			}
			if (
				prop.type === CompilerDOM.NodeTypes.DIRECTIVE
				&& (
					prop.name === 'on'
						&& (prop.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION && prop.arg.isStatic)
					|| prop.name === 'model'
						&& (!prop.arg || prop.arg.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION && prop.arg.isStatic)
				)
			) {
				let source = prop.arg?.loc.source ?? 'model-value';
				let propPrefix = 'on-';
				if (prop.name === 'model') {
					propPrefix = 'onUpdate:';
				}
				else if (source.startsWith('vue:')) {
					source = source.slice('vue:'.length);
					propPrefix = 'onVnode-';
				}
				const key = [
					prop.name,
					camelize(propPrefix + source),
					...prop.modifiers.map(modifier => modifier.content),
				].join('+');
				let items = definitions.get(key);
				if (!items) {
					definitions.set(key, items = []);
				}
				items.push(prop);
			}
		}
		for (const prop of writeBacks) {
			visitModelEventExpression(template, prop);
		}
		for (const items of definitions.values()) {
			for (const prop of items) {
				if (prop.name === 'on') {
					visitEventExpression(template, prop);
				}
				else {
					visitModelEventExpression(template, prop);
				}
			}
		}
	}

	function visitEventExpression(template: IRTemplate, prop: CompilerDOM.DirectiveNode) {
		if (prop.exp?.type !== CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
			return;
		}
		const ast = getTypeScriptAST(ts, template, prop.exp.content);
		if (isCompoundExpression(ts, ast)) {
			const scope = openScope(true);
			scope.declare('$event');
			visitInterpolation(template, prop.exp.content, prop.exp.loc.start.offset);
			scope.end();
			inlayHints.push({
				blockName: 'template',
				offset: prop.exp.loc.start.offset,
				setting: 'vue.inlayHints.inlineHandlerLeading',
				label: '$event =>',
				paddingRight: true,
				tooltip: [
					'`$event` is a hidden parameter, you can use it in this callback.',
					'To hide this hint, set `vue.inlayHints.inlineHandlerLeading` to `false` in IDE settings.',
					'[More info](https://github.com/vuejs/language-tools/issues/2445#issuecomment-1444771420)',
				].join('\n\n'),
			});
		}
		else {
			visitInterpolation(template, prop.exp.content, prop.exp.loc.start.offset, `(`, `)`);
		}
	}

	function visitModelEventExpression(template: IRTemplate, prop: CompilerDOM.DirectiveNode) {
		if (prop.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
			visitInterpolation(template, prop.exp.content, prop.exp.loc.start.offset, '', '', true);
		}
	}

	function visitElementDirectives(template: IRTemplate, isVapor: boolean, node: CompilerDOM.ElementNode) {
		for (const prop of node.props) {
			if (
				prop.type !== CompilerDOM.NodeTypes.DIRECTIVE
				|| prop.name === 'slot'
				|| prop.name === 'on'
				|| prop.name === 'model'
				|| prop.name === 'bind'
			) {
				continue;
			}
			if (!isBuiltInDirective(prop.name)) {
				record(camelize('v-' + prop.name));
			}
			const visitValue = () => {
				if (prop.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
					visitPropExp(template, prop, prop.exp);
				}
			};
			if (isVapor && !isBuiltInDirective(prop.name)) {
				visitValue();
			}
			if (prop.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION && !prop.arg.isStatic) {
				visitInterpolation(
					template,
					prop.arg.content,
					prop.arg.loc.start.offset + prop.arg.loc.source.indexOf(prop.arg.content),
					`(`,
					`)`,
				);
			}
			for (const modifier of prop.modifiers) {
				visitObjectProperty(template, modifier.content, modifier.loc.start.offset);
			}
			if (!(isVapor && !isBuiltInDirective(prop.name))) {
				visitValue();
			}
		}
	}
}

/** The nodes that are operands of a binary or postfix unary expression. */
function collectOperands(ts: TypeScript, ast: ts.SourceFile) {
	const operands = new Set<ts.Node>();
	ast.forEachChild(function visit(node) {
		if (ts.isBinaryExpression(node)) {
			operands.add(node.left).add(node.right);
		}
		else if (ts.isPostfixUnaryExpression(node)) {
			operands.add(node.operand);
		}
		node.forEachChild(visit);
	});
	return operands;
}

export function createVBindShorthandInlayHintInfo(
	loc: CompilerDOM.SourceLocation,
	variableName: string,
): InlayHintInfo {
	return {
		blockName: 'template',
		offset: loc.end.offset,
		setting: 'vue.inlayHints.vBindShorthand',
		label: `="${variableName}"`,
		tooltip: [
			`This is a shorthand for \`${loc.source}="${variableName}"\`.`,
			'To hide this hint, set `vue.inlayHints.vBindShorthand` to `false` in IDE settings.',
			'[More info](https://github.com/vuejs/core/pull/9451)',
		].join('\n\n'),
	};
}
