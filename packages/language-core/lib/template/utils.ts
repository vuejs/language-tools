import {
	type NodeTransform,
	NodeTypes,
	type SourceLocation,
	type StructuralDirectiveTransform,
} from '@vue/compiler-dom';
import { isString } from '@vue/shared';

export function createStructuralDirectiveTransform(
	name: string | RegExp,
	fn: StructuralDirectiveTransform,
): NodeTransform {
	const matches = isString(name)
		? (n: string) => n === name
		: (n: string) => name.test(n);

	return (node, context) => {
		if (node.type === NodeTypes.ELEMENT) {
			const { props } = node;
			const exitFns = [];
			for (let i = 0; i < props.length; i++) {
				const prop = props[i]!;
				if (prop.type === NodeTypes.DIRECTIVE && matches(prop.name)) {
					props.splice(i, 1);
					i--;
					const onExit = fn(node, prop, context);
					if (onExit) {
						exitFns.push(onExit);
					}
				}
			}
			return exitFns;
		}
	};
}

export function cloneLoc(loc: SourceLocation): SourceLocation {
	return {
		start: { ...loc.start },
		end: { ...loc.end },
		source: loc.source,
	};
}
