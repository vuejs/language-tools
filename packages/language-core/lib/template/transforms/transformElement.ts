import {
	createCompilerError,
	type DirectiveNode,
	ElementTypes,
	ErrorCodes,
	findDir,
	isStaticExp,
	isTemplateNode,
	type NodeTransform,
	NodeTypes,
	type TemplateChildNode,
} from '@vue/compiler-dom';
import { isBuiltInDirective } from '@vue/shared';

export const transformElement: NodeTransform = (node, context) => {
	return () => {
		if (node.type !== NodeTypes.ELEMENT || node.tagType === ElementTypes.TEMPLATE) {
			return;
		}

		const isComponent = node.tagType === ElementTypes.COMPONENT;
		const isSlotOutlet = node.tagType === ElementTypes.SLOT;

		for (const prop of node.props) {
			if (prop.type !== NodeTypes.DIRECTIVE) {
				continue;
			}

			if (prop.name === 'slot') {
				if (!isComponent) {
					context.onError(
						createCompilerError(ErrorCodes.X_V_SLOT_MISPLACED, prop.loc),
					);
				}
				continue;
			}

			const isVBind = prop.name === 'bind';
			const isVOn = prop.name === 'on';

			if (!prop.arg && (isVBind || isVOn)) {
				if (!prop.exp) {
					context.onError(
						createCompilerError(
							isVBind
								? ErrorCodes.X_V_BIND_NO_EXPRESSION
								: ErrorCodes.X_V_ON_NO_EXPRESSION,
							prop.loc,
						),
					);
				}
				continue;
			}

			const runtimeDirectives: DirectiveNode[] = [];
			const directiveTransform = context.directiveTransforms[prop.name];
			if (directiveTransform) {
				const { needRuntime } = directiveTransform(prop, node, context);
				if (needRuntime) {
					runtimeDirectives.push(prop);
				}
			}
			else if (!isBuiltInDirective(prop.name)) {
				runtimeDirectives.push(prop);
			}

			if (isSlotOutlet && runtimeDirectives.length) {
				context.onError(
					createCompilerError(ErrorCodes.X_V_SLOT_UNEXPECTED_DIRECTIVE_ON_SLOT_OUTLET, prop.loc),
				);
			}
		}

		if (isComponent) {
			let hasTemplateSlots = false;
			let hasNamedDefaultSlot = false;
			const implicitDefaultChildren: TemplateChildNode[] = [];
			const seenSlotNames = new Set<string>();
			const onComponentSlot = findDir(node, 'slot', true);

			for (const child of node.children) {
				let slotDir: DirectiveNode | undefined;
				if (!isTemplateNode(child) || !(slotDir = findDir(child, 'slot', true))) {
					if (child.type !== NodeTypes.COMMENT) {
						implicitDefaultChildren.push(child);
					}
					continue;
				}

				if (onComponentSlot) {
					context.onError(
						createCompilerError(ErrorCodes.X_V_SLOT_MIXED_SLOT_USAGE, slotDir.loc),
					);
					break;
				}

				if (findDir(child, /^(?:if|else-if|else|for)$/, true)) {
					continue;
				}

				hasTemplateSlots = true;
				const staticSlotName = slotDir.arg
					? isStaticExp(slotDir.arg)
						? slotDir.arg.content
						: undefined
					: 'default';

				if (staticSlotName) {
					if (seenSlotNames.has(staticSlotName)) {
						context.onError(
							createCompilerError(ErrorCodes.X_V_SLOT_DUPLICATE_SLOT_NAMES, slotDir.loc),
						);
						continue;
					}
					seenSlotNames.add(staticSlotName);
					if (staticSlotName === 'default') {
						hasNamedDefaultSlot = true;
					}
				}
			}

			if (
				hasTemplateSlots && hasNamedDefaultSlot
				&& implicitDefaultChildren.some(node => node.type !== NodeTypes.TEXT || !!node.content.trim())
			) {
				context.onError(
					createCompilerError(
						ErrorCodes.X_V_SLOT_EXTRANEOUS_DEFAULT_SLOT_CHILDREN,
						implicitDefaultChildren[0]!.loc,
					),
				);
			}

			context.components.add(node.tag);
		}
	};
};
