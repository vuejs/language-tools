import * as CompilerDOM from '@vue/compiler-dom';
import { forEachElementNode } from './template';
import { enableAllFeatures } from './utils';
import type { Code } from '../types';

const codeFeatures = enableAllFeatures({
	format: false,
	structure: false,
});

export function* generate(templateAst: NonNullable<CompilerDOM.RootNode>): Generator<Code> {
	for (const node of forEachElementNode(templateAst)) {
		for (const prop of node.props) {
			if (
				prop.type === CompilerDOM.NodeTypes.DIRECTIVE
				&& prop.name === 'bind'
				&& prop.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
				&& prop.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
				&& prop.arg.content === 'style'
				&& prop.exp.constType === CompilerDOM.ConstantTypes.CAN_STRINGIFY
			) {
				const endCrt = prop.arg.loc.source[prop.arg.loc.source.length - 1]; // " | '
				const start = prop.arg.loc.source.indexOf(endCrt) + 1;
				const end = prop.arg.loc.source.lastIndexOf(endCrt);
				const content = prop.arg.loc.source.substring(start, end);

				yield `x { `;
				yield [
					content,
					'template',
					prop.arg.loc.start.offset + start,
					codeFeatures,
				];
				yield ` }\n`;
			}
		}
	}
}
