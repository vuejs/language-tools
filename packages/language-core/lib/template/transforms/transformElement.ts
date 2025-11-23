import { ElementTypes, type NodeTransform, NodeTypes } from '@vue/compiler-dom';

export const transformElement: NodeTransform = (node, context) => {
	return () => {
		if (node.type === NodeTypes.ELEMENT && node.tagType === ElementTypes.COMPONENT) {
			context.components.add(node.tag);
		}
	};
};
