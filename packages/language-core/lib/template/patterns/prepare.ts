import * as CompilerDOM from '@vue/compiler-dom';
import { type MatchArm, parseMatchPattern, PatternSyntaxError } from './parser';

export interface TemplateMatchArm extends MatchArm {
	node: CompilerDOM.ElementNode;
	directive: CompilerDOM.DirectiveNode;
	offset: number;
}
export interface TemplateMatch {
	subject: CompilerDOM.SimpleExpressionNode;
	arms: TemplateMatchArm[];
}
const matches = new WeakMap<CompilerDOM.ElementNode, TemplateMatch>();
export const getTemplateMatch = (node: CompilerDOM.ElementNode) => matches.get(node);

export function prepareTemplateMatches(ast: CompilerDOM.RootNode, options: CompilerDOM.CompilerOptions) {
	function report(message: string, loc: CompilerDOM.SourceLocation, warning = false) {
		const error = Object.assign(new SyntaxError(message), { code: 'V_MATCH_SYNTAX', loc });
		if (warning) {
			options.onWarn?.(error);
		}
		else if (options.onError) {
			options.onError(error);
		}
		else {
			throw error;
		}
	}
	function visit(node: CompilerDOM.RootNode | CompilerDOM.TemplateChildNode) {
		if (node.type !== CompilerDOM.NodeTypes.ROOT && node.type !== CompilerDOM.NodeTypes.ELEMENT) {
			return;
		}
		if (node.type === CompilerDOM.NodeTypes.ELEMENT) {
			const orphan = CompilerDOM.findDir(node, 'when', true);
			if (orphan) {
				report('v-when must be a direct child of v-match.', orphan.loc);
				node.props = node.props.filter(p => p !== orphan);
			}
			const match = CompilerDOM.findDir(node, 'match', true);
			if (match) {
				node.props = node.props.filter(p => p !== match);
				if (
					!match.exp || match.exp.type !== CompilerDOM.NodeTypes.SIMPLE_EXPRESSION || !match.exp.content.trim()
					|| match.arg || match.modifiers.length
				) {
					report('v-match requires a subject expression and accepts no arguments or modifiers.', match.loc);
					return;
				}
				const arms: TemplateMatchArm[] = [];
				let wildcard = false;
				for (const child of node.children) {
					if (
						child.type === CompilerDOM.NodeTypes.COMMENT
						|| (child.type === CompilerDOM.NodeTypes.TEXT && !child.content.trim())
					) {
						continue;
					}
					const when = child.type === CompilerDOM.NodeTypes.ELEMENT && CompilerDOM.findDir(child, 'when', true);
					if (!when || child.type !== CompilerDOM.NodeTypes.ELEMENT) {
						report('Every direct child of v-match must declare v-when.', child.loc, true);
						continue;
					}
					child.props = child.props.filter(p => p !== when);
					if (
						!when.exp || when.exp.type !== CompilerDOM.NodeTypes.SIMPLE_EXPRESSION || when.arg || when.modifiers.length
					) {
						report('v-when requires a pattern and accepts no arguments or modifiers.', when.loc);
						continue;
					}
					if (CompilerDOM.findDir(child, /^(if|else-if|else|for|match)$/, true)) {
						report('v-when cannot share an element with another structural directive.', when.loc);
						continue;
					}
					try {
						const arm = parseMatchPattern(when.exp.content);
						if (wildcard) {
							report('An unguarded wildcard arm must be last and unique.', when.loc);
						}
						if (arm.pattern.kind === 'wildcard' && !arm.guard) {
							wildcard = true;
						}
						if (child.tag === 'template') {
							child.tagType = CompilerDOM.ElementTypes.TEMPLATE;
						}
						arms.push({ ...arm, node: child, directive: when, offset: when.exp.loc.start.offset });
					}
					catch (error) {
						if (!(error instanceof PatternSyntaxError)) {
							throw error;
						}
						report(error.message, when.exp.loc);
					}
				}
				if (!arms.length) {
					report('v-match has no v-when arms.', match.loc, true);
				}
				const block: TemplateMatch = { subject: match.exp, arms };
				const children = arms.map(arm => arm.node);
				if (node.tag === 'template' && node.props.length === 0) {
					node.tagType = CompilerDOM.ElementTypes.TEMPLATE;
					node.children = children;
					matches.set(node, block);
				}
				else {
					const inner: CompilerDOM.ElementNode = {
						type: CompilerDOM.NodeTypes.ELEMENT,
						tag: 'template',
						tagType: CompilerDOM.ElementTypes.TEMPLATE,
						ns: node.ns,
						props: [],
						children,
						loc: node.loc,
						codegenNode: undefined,
					};
					matches.set(inner, block);
					node.children = [inner];
				}
			}
		}
		for (const child of node.children) {
			visit(child);
		}
	}
	visit(ast);
}
