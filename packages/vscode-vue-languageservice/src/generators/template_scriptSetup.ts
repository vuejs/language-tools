import * as CompilerDOM from '@vue/compiler-dom';
import * as CompilerCore from '@vue/compiler-dom';
import { transformContext } from './template';


export function generate(node: CompilerDOM.RootNode) {

	let text = '';
	const tags = new Set<string>();

	for (const child of node.children) {
		visitNode(child);
	}

	return {
		text,
		tags,
	};

	function visitNode(node: CompilerDOM.TemplateChildNode): void {
		if (node.type === CompilerDOM.NodeTypes.ELEMENT) {

			// TODO: track https://github.com/vuejs/vue-next/issues/3498
			const forDirective = node.props.find(
				(prop): prop is CompilerDOM.DirectiveNode =>
					prop.type === CompilerDOM.NodeTypes.DIRECTIVE
					&& prop.name === 'for'
			);
			if (forDirective) {
				node.props = node.props.filter(prop => prop !== forDirective);
				let forNode: CompilerDOM.ForNode | undefined;
				CompilerCore.processFor(node, forDirective, transformContext, _forNode => {
					forNode = _forNode;
					return undefined;
				});
				if (forNode) {
					forNode.children = [node];
					visitNode(forNode);
					return;
				}
			}

			tags.add(node.tag);
			text += `{\n`;
			for (const prop of node.props) {
				if (
					prop.type === CompilerDOM.NodeTypes.DIRECTIVE
					&& prop.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
				) {
					if (prop.name === 'slot') {
						text += `let ${prop.exp.content} = {} as any;\n`;
					}
					else if (prop.name === 'on') {
						text += `() => { ${prop.exp.content} };\n`;
					}
					else {
						text += `(${prop.exp.content});\n`;
					}
				}
				else if (
					prop.type === CompilerDOM.NodeTypes.DIRECTIVE
					&& prop.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
					&& prop.arg.content !== ''
				) {
					text += `(${prop.arg.content});\n`;
				}
				else if (
					prop.type === CompilerDOM.NodeTypes.ATTRIBUTE
					&& prop.name === 'ref'
					&& prop.value
				) {
					text += `// @ts-ignore\n`;
					text += `(${prop.value.content});\n`;
				}
			}
			for (const childNode of node.children) {
				visitNode(childNode);
			}
			text += '}\n';
		}
		else if (node.type === CompilerDOM.NodeTypes.TEXT_CALL) {
			// {{ var }}
			visitNode(node.content);
		}
		else if (node.type === CompilerDOM.NodeTypes.COMPOUND_EXPRESSION) {
			// {{ ... }} {{ ... }}
			for (const childNode of node.children) {
				if (typeof childNode === 'object') {
					visitNode(childNode as CompilerDOM.TemplateChildNode);
				}
			}
		}
		else if (node.type === CompilerDOM.NodeTypes.INTERPOLATION) {
			// {{ ... }}
			const context = node.loc.source.substring(2, node.loc.source.length - 2);
			text += `{ ${context} };\n`;
		}
		else if (node.type === CompilerDOM.NodeTypes.IF) {
			// v-if / v-else-if / v-else
			for (let i = 0; i < node.branches.length; i++) {

				const branch = node.branches[i];

				if (i === 0)
					text += 'if';
				else if (branch.condition)
					text += 'else if';
				else
					text += 'else';

				if (branch.condition?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
					text += ` (${branch.condition.content})`;
				}
				text += ` {\n`;
				for (const childNode of branch.children) {
					visitNode(childNode);
				}
				text += '}\n';
			}
		}
		else if (node.type === CompilerDOM.NodeTypes.FOR) {
			// v-for
			const source = node.parseResult.source;
			const value = node.parseResult.value;
			const key = node.parseResult.key;
			const index = node.parseResult.index;

			if (
				source.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
				&& value?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
			) {
				text += `for (let ${value.content} of ${source.content}) {\n`
				if (key?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION)
					text += `let ${key.content} = {} as any;`;
				if (index?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION)
					text += `let ${index.content} = {} as any;`;
				for (const childNode of node.children) {
					visitNode(childNode);
				}
				text += '}\n';
			}
		}
	};
}
