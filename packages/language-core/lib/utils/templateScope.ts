import * as CompilerDOM from '@vue/compiler-dom';
import { camelize, capitalize, isBuiltInDirective } from '@vue/shared';
import type * as ts from 'typescript/ast' with { 'resolution-mode': 'import' };
import type { IR, IRBlock, IRStyle, IRTemplate, TypeScript, VueCompilerOptions } from '../types';
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
	getTemplateRef,
	normalizeAttributeValue,
} from './elements';
import { getNodeText, getStartEnd } from './nodes';
import { isCompoundExpression, parseInterpolationNode, parseVForAliases } from './templateExpressions';
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

/** An identifier that a template expression references, at its offset in the code of the expression. */
export interface TemplateReference {
	name: string;
	offset: number;
	/** The name of a shorthand property assignment, like `{ name }`. */
	isShorthand: boolean;
	inTypeQuery: boolean;
	/** The callee of a `new` expression. */
	isNewOperand: boolean;
	/** A local of the expression or of a block scope around it, or a global: the code reads the name as is. */
	local: boolean;
	/** A member of the nearest block scope. */
	member: boolean;
}

/** The identifiers that the code of a template expression, or an identifier like a component tag, references. */
export interface TemplateExpression {
	code: string;
	references: TemplateReference[];
}

export interface TemplateScopeMember {
	name: string;
	/** The name of the block that references the member. */
	block: string;
	offset: number;
	/** The name in the source, like the hyphenated `v-my-dir` of `vMyDir`. */
	sourceName: string;
}

/** The template, a `v-for`, a slot, an inline handler, or the styles. */
export interface TemplateBlockScope {
	/** The names that the block scope declares, like the aliases of a `v-for`. */
	declared: ReadonlySet<string>;
	/** The references that the block scope lists, in the order of their first reference. */
	members: TemplateScopeMember[];
	/**
	 * The declared names of the block scope and the block scopes around it that their members reference when the
	 * block scope ends, and the names that the code of the block scope always reads, like `$event`.
	 */
	locals: string[];
}

/**
 * The node a block scope belongs to: the template, the styles, a `v-for`, the element of a slot, or the directive
 * of an inline handler.
 */
export type TemplateBlockScopeOwner =
	| IRTemplate
	| readonly IRStyle[]
	| CompilerDOM.ForNode
	| CompilerDOM.ElementNode
	| CompilerDOM.DirectiveNode;

export type TemplateScope = ReturnType<typeof collectTemplateScope>;

export interface TemplateScopeOptions {
	vueCompilerOptions: VueCompilerOptions;
	isVapor: boolean;
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

class BlockScope extends Scope {
	read = new Set<string>();
	members: TemplateScopeMember[] = [];
}

/**
 * The scope analysis of the template and the style `v-bind()`s, which a TypeScript code generation reads
 * instead of walking the scopes itself: the identifiers that each expression references
 * and whether they are locals or members of a block scope, the block scopes, the names that the block scopes list,
 * the setup bindings that a narrowing position reads, the template's references to the template context, and the
 * inlay hints of the template. The traversal visits the expressions in the order of the code generation, which
 * reads `expressions` and `blockScopes` by the offset of each expression and by the node of each block scope.
 */
export function collectTemplateScope(ts: TypeScript, ir: IR, options: TemplateScopeOptions) {
	const { vueCompilerOptions, isVapor, setupBindings, setupConsts, setupRefs, hasDefineSlots } = options;
	const templateNames = new Set<string>();
	const styleNames = new Set<string>();
	const contextAccesses: ContextAccess[] = [];
	const inlayHints: InlayHintInfo[] = [];
	const dotValueBindings = new Set<string>();
	const expressions = new Map<IRBlock, Map<number, TemplateExpression>>();
	const blockScopes = new Map<TemplateBlockScopeOwner, TemplateBlockScope>();

	let names = templateNames;
	const scopes: Scope[] = [];
	const ctx = { scopes, scope: () => openScope(new Scope()) };
	const dollarVars = new Set<string>();
	const commentBuffer: CompilerDOM.CommentNode[] = [];
	const slotNames: (readonly [name: string, offset: number])[] = [];
	const templateRefs = new Map<string, number[]>();
	let components = 0;

	if (ir.template) {
		const template = ir.template;
		const scope = openScope(new BlockScope());
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
			for (const [name, offsets] of templateRefs) {
				for (const offset of offsets) {
					visitObjectProperty(template, name, offset);
				}
			}
		}
		closeBlockScope(scope, template);
	}

	if (ir.styles.length) {
		names = styleNames;
		const scope = openScope(new BlockScope());
		for (const style of ir.styles) {
			for (const binding of style.bindings) {
				visitInterpolation(style, binding.text, binding.offset, `(`, `)`);
			}
		}
		closeBlockScope(scope, ir.styles);
	}

	return {
		templateNames,
		styleNames,
		contextAccesses,
		inlayHints,
		dotValueBindings,
		expressions: expressions as ReadonlyMap<IRBlock, ReadonlyMap<number, TemplateExpression>>,
		blockScopes: blockScopes as ReadonlyMap<TemplateBlockScopeOwner, TemplateBlockScope>,
	};

	function openScope<T extends Scope>(scope: T) {
		scope.scopes = scopes;
		scopes.push(scope);
		return scope;
	}

	function closeBlockScope(scope: BlockScope, owner: TemplateBlockScopeOwner) {
		scope.end();
		const isDeclared = (name: string) =>
			scope.has(name) || scopes.some(scope => scope instanceof BlockScope && scope.has(name));
		const memberNames = [scope, ...scopes].flatMap(scope =>
			scope instanceof BlockScope ? scope.members.map(({ name }) => name) : []
		);
		blockScopes.set(owner, {
			declared: new Set(scope),
			members: scope.members,
			locals: [...new Set([...scope.read, ...memberNames.filter(isDeclared)])],
		});
	}

	function addExpression(block: IRBlock, start: number, expression: TemplateExpression) {
		let blockExpressions = expressions.get(block);
		if (!blockExpressions) {
			expressions.set(block, blockExpressions = new Map());
		}
		blockExpressions.set(start, expression);
	}

	/** The nearest block scope lists the name, unless a local of the expression around it declares the name. */
	function record(block: IRBlock, name: string, offset: number, sourceName = name) {
		if (isLiteralWhitelisted(name) || name === 'require' || name.startsWith('__VLS_')) {
			return false;
		}
		for (let i = scopes.length - 1; i >= 0; i--) {
			const scope = scopes[i]!;
			if (scope instanceof BlockScope) {
				if (!scope.members.some(member => member.block === block.name && member.offset === offset)) {
					scope.members.push({ name, block: block.name, offset, sourceName });
				}
				names.add(name);
				return true;
			}
			if (scope.has(name)) {
				return false;
			}
		}
		return false;
	}

	/**
	 * `isWriteBack`: the code generation assigns to the expression, like the update of a `v-model`.
	 * `inNarrowing`: the expression is a narrowing position, like the condition of a `v-if`.
	 * `isEndTag`: the expression repeats the start tag at the end tag, and the start tag reports the context accesses.
	 */
	function visitInterpolation(
		block: IRBlock,
		code: string,
		start: number,
		prefix = '',
		suffix = '',
		{ isWriteBack = false, inNarrowing = false, isEndTag = false } = {},
	) {
		const references: TemplateReference[] = [];
		addExpression(block, start, { code, references });
		if (identifierRE.test(code)) {
			const local = shouldIdentifierSkipped(ctx, code);
			references.push({
				name: code,
				offset: 0,
				isShorthand: false,
				inTypeQuery: false,
				isNewOperand: false,
				local,
				member: record(block, code, start),
			});
			if (!local) {
				if (!isEndTag) {
					visitContextAccess(block, code, start, isWriteBack);
				}
				visitNarrowing(code, inNarrowing);
			}
			return;
		}
		const scope = ctx.scope();
		const ast = getTypeScriptAST(ts, block, prefix + code + suffix);
		let operands: Set<ts.Node> | undefined;
		for (
			const { id, isShorthand, isNarrowing, skipped, inTypeQuery, isNewOperand } of forEachDeclarations(
				ts,
				ast,
				ast,
				ctx,
				scope,
				inNarrowing,
			)
		) {
			const name = getNodeText(id, ast);
			const offset = getStartEnd(id, ast).start - prefix.length;
			references.push({
				name,
				offset,
				isShorthand,
				inTypeQuery,
				isNewOperand,
				local: skipped,
				member: record(block, name, start + offset),
			});
			if (!skipped) {
				if (!isEndTag) {
					operands ??= collectOperands(ts, ast);
					visitContextAccess(block, name, start + offset, operands.has(id));
				}
				visitNarrowing(name, isNarrowing || inTypeQuery);
			}
		}
		scope.end();
	}

	/** A setup binding that a narrowing position or a type query reads: the code generation reads its `.value`. */
	function visitNarrowing(name: string, isNarrowing: boolean) {
		if (isNarrowing && setupBindings.has(name) && !setupConsts.has(name) && !setupRefs.has(name)) {
			dotValueBindings.add(name);
		}
	}

	/** An identifier the code generation references outside of an expression, like a component tag. */
	function visitIdentifier(block: IRBlock, name: string, start: number, isEndTag = false) {
		const reference: TemplateReference = {
			name,
			offset: 0,
			isShorthand: false,
			inTypeQuery: false,
			isNewOperand: false,
			local: shouldIdentifierSkipped(ctx, name),
			member: false,
		};
		addExpression(block, start, { code: name, references: [reference] });
		if (setupConsts.has(name) || reference.local || setupRefs.has(name)) {
			return;
		}
		if (setupBindings.has(name) || !dollarVars.has(name)) {
			reference.member = record(block, name, start);
		}
		if (!isEndTag) {
			visitContextAccess(block, name, start, false);
		}
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

	function visitPropertyAccess(template: IRTemplate, code: string, start: number, isEndTag = false) {
		if (code.startsWith('[') && code.endsWith(']')) {
			visitInterpolation(template, code, start, '', '', { isEndTag });
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
						{ inNarrowing: true },
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
		let [tagOffset, endTagOffset] = getElementTagOffsets(node, template);
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
				endTagOffset = undefined;
				props = props.filter(p => p !== prop);
			}
		}
		if (isExpression) {
			visitInterpolation(template, tag, tagOffset, `(`, `)`);
			if (endTagOffset !== undefined) {
				visitInterpolation(template, tag, endTagOffset, `(`, `)`, { isEndTag: true });
			}
		}
		else {
			const originalNames = new Set([capitalize(camelize(tag)), camelize(tag), tag]);
			const matchedBinding = [...originalNames].find(name => setupBindings.has(name));
			if (matchedBinding) {
				visitIdentifier(template, matchedBinding, tagOffset);
				if (endTagOffset !== undefined) {
					visitIdentifier(template, matchedBinding, endTagOffset, true);
				}
			}
		}

		components++;
		visitElementProps(template, node, props, true);
		visitElementEvents(template, node);
		visitElementDirectives(template, isVapor, node);
		visitTemplateRef(node);
		const slotDir = node.props.find(CompilerDOM.isVSlot);
		if (slotDir || node.children.length) {
			visitVSlot(template, isVapor, node, slotDir);
		}
		components--;
	}

	function visitTemplateRef(node: CompilerDOM.ElementNode) {
		const templateRef = getTemplateRef(node);
		if (templateRef) {
			const [name, offset] = templateRef;
			let offsets = templateRefs.get(name);
			if (!offsets) {
				templateRefs.set(name, offsets = []);
			}
			offsets.push(offset);
		}
	}

	function visitElement(template: IRTemplate, isVapor: boolean, node: CompilerDOM.ElementNode) {
		const [startTagOffset, endTagOffset] = getElementTagOffsets(node, template);
		visitPropertyAccess(template, node.tag, startTagOffset);
		if (endTagOffset !== undefined) {
			visitPropertyAccess(template, node.tag, endTagOffset, true);
		}
		visitElementProps(template, node, node.props, true);
		visitElementDirectives(template, isVapor, node);
		visitTemplateRef(node);
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
		const scope = openScope(new BlockScope());
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
		closeBlockScope(scope, node);
	}

	function visitVFor(template: IRTemplate, isVapor: boolean, node: CompilerDOM.ForNode) {
		const { source } = node.parseResult;
		const { leftExpressionRange, leftExpressionText, bindingNames, defaultInitializerRanges } = parseVForAliases(
			ts,
			template,
			node,
		);
		if (source.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
			visitInterpolation(template, source.content, source.loc.start.offset, `(`, `)`);
		}
		const scope = openScope(new BlockScope());
		scope.declare(...bindingNames);
		for (const [start, end] of defaultInitializerRanges) {
			visitInterpolation(template, leftExpressionText!.slice(start, end), leftExpressionRange!.start + start);
		}
		for (const child of node.children) {
			visitTemplateChild(template, isVapor, child, false, true);
		}
		closeBlockScope(scope, node);
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
			const scope = openScope(new BlockScope());
			scope.declare('$event');
			scope.read.add('$event');
			visitInterpolation(template, prop.exp.content, prop.exp.loc.start.offset);
			closeBlockScope(scope, prop);
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
			visitInterpolation(template, prop.exp.content, prop.exp.loc.start.offset, '', '', {
				isWriteBack: true,
				inNarrowing: true,
			});
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
				record(template, camelize('v-' + prop.name), prop.loc.start.offset, 'v-' + prop.name);
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
