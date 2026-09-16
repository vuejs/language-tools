import {
	type CompilerOptions,
	type DirectiveNode,
	getBaseTransformPreset,
	parse,
	type RootNode,
	transform,
} from '@vue/compiler-dom';
import { prepareTemplateMatches } from './patterns/prepare';
import { transformElement } from './transforms/transformElement';
import { transformText } from './transforms/transformText';
import { transformFor } from './transforms/vFor';
import { transformIf } from './transforms/vIf';

export function compileTemplate(source: string, options: CompilerOptions, rootMatch?: DirectiveNode) {
	const ast = parse(source, options);
	prepareTemplateMatches(ast, options, rootMatch);
	transformTemplate(ast, options);
	return ast;
}

export function transformTemplate(ast: RootNode, options: CompilerOptions) {
	const [nodeTransforms, directiveTransforms] = getBaseTransformPreset();
	transform(ast, {
		...options,
		nodeTransforms: [
			nodeTransforms[0]!, // transformVBindShorthand
			transformIf,
			transformFor,
			transformElement,
			transformText,
			...options.nodeTransforms || [],
		],
		directiveTransforms: {
			...directiveTransforms,
			...options.directiveTransforms,
		},
	});
}
