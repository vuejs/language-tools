import { createCompilerError, ErrorCodes, type ForNode, NodeTypes } from '@vue/compiler-dom';
import { createStructuralDirectiveTransform } from '../utils';

export const transformFor = createStructuralDirectiveTransform(
	'for',
	(node, dir, context) => {
		if (!dir.exp) {
			context.onError(
				createCompilerError(ErrorCodes.X_V_FOR_NO_EXPRESSION, dir.loc),
			);
			return;
		}

		const parseResult = dir.forParseResult;
		if (!parseResult) {
			context.onError(
				createCompilerError(ErrorCodes.X_V_FOR_MALFORMED_EXPRESSION, dir.loc),
			);
			return;
		}

		const { source, value, key, index } = parseResult;
		const forNode: ForNode = {
			type: NodeTypes.FOR,
			loc: dir.loc,
			source,
			valueAlias: value,
			keyAlias: key,
			objectIndexAlias: index,
			parseResult,
			children: [node],
		};

		context.replaceNode(forNode);
	},
);
