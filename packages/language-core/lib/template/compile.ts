import { type CompilerOptions, getBaseTransformPreset, parse, transform } from '@vue/compiler-dom';
import { transformText } from './transforms/transformText';
import { transformFor } from './transforms/vFor';
import { transformIf } from './transforms/vIf';

export function compileTemplate(source: string, options: CompilerOptions) {
	const [nodeTransforms, directiveTransforms] = getBaseTransformPreset();
	const resolvedOptions: CompilerOptions = {
		...options,
		comments: true,
		nodeTransforms: [
			nodeTransforms[0]!, // transformVBindShorthand
			transformIf,
			transformFor,
			transformText,
			...options.nodeTransforms || [],
		],
		directiveTransforms: {
			...directiveTransforms,
			...options.directiveTransforms,
		},
	};

	const ast = parse(source, resolvedOptions);
	transform(ast, resolvedOptions);
	return ast;
}
