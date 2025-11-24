import { createCompilerError, ElementTypes, ErrorCodes, type NodeTransform, NodeTypes } from '@vue/compiler-dom';
import { isBuiltInDirective } from '@vue/shared';

export const transformElement: NodeTransform = (node, context) => {
	return () => {
		if (node.type !== NodeTypes.ELEMENT || node.tagType === ElementTypes.TEMPLATE) {
			return;
		}

		const isComponent = node.tagType === ElementTypes.COMPONENT;
		const isSlotOutlet = node.tagType === ElementTypes.SLOT;

		if (isComponent) {
			context.components.add(node.tag);
		}

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

			const result = context.directiveTransforms[prop.name]?.(prop, node, context);
			if (isSlotOutlet && (result?.needRuntime || !isBuiltInDirective(prop.name))) {
				context.onError(
					createCompilerError(ErrorCodes.X_V_SLOT_UNEXPECTED_DIRECTIVE_ON_SLOT_OUTLET, prop.loc),
				);
			}
		}
	};
};
