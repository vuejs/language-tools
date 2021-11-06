import * as CompilerDOM from '@vue/compiler-dom';
import { camelize } from '@vue/shared';
import { getPatchForSlotNode } from './template';

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

			const patchForNode = getPatchForSlotNode(node);
			if (patchForNode) {
				visitNode(patchForNode);
				return;
			}

			tags.add(node.tag);
			text += `{\n`;
			for (const prop of node.props) {
				if (prop.type === CompilerDOM.NodeTypes.DIRECTIVE) {

					// arg
					if (prop.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION && !prop.arg.isStatic) {
						text += `// @ts-ignore\n`;
						text += `(${wrapTsIgnores(prop.arg.loc.source)});\n`;
					}

					// exp
					if (prop.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
						if (prop.name === 'slot') {
							text += `// @ts-ignore\n`;
							text += `let ${wrapTsIgnores(prop.exp.content)} = {} as any;\n`;
						}
						else if (prop.name === 'on') {
							text += `// @ts-ignore\n`;
							text += `() => { ${wrapTsIgnores(prop.exp.content)} };\n`;
						}
						else {
							text += `// @ts-ignore\n`;
							text += `(${wrapTsIgnores(prop.exp.content)});\n`;
						}
					}

					// name
					if (
						prop.name !== 'slot'
						&& prop.name !== 'on'
						&& prop.name !== 'model'
						&& prop.name !== 'bind'
					) {
						text += `// @ts-ignore\n`;
						text += `(${camelize('v-' + prop.name)});\n`;
					}
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
			text += `// @ts-ignore\n`;
			text += `{ ${context} };\n`;
		}
		else if (node.type === CompilerDOM.NodeTypes.IF) {
			// v-if / v-else-if / v-else
			for (let i = 0; i < node.branches.length; i++) {

				const branch = node.branches[i];

				text += `// @ts-ignore\n`;

				if (i === 0)
					text += 'if';
				else if (branch.condition)
					text += 'else if';
				else
					text += 'else';

				if (branch.condition?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
					text += ` (${wrapTsIgnores(branch.condition.content)})`;
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
				text += `// @ts-ignore\n`;
				text += `for (let ${wrapTsIgnores(value.content)} of ${wrapTsIgnores(source.content, value.content.indexOf('\n') >= 0)}) {\n`
				if (key?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
					text += `// @ts-ignore\n`;
					text += `let ${wrapTsIgnores(key.content)} = {} as any;`;
				}
				if (index?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
					text += `// @ts-ignore\n`;
					text += `let ${wrapTsIgnores(index.content)} = {} as any;`;
				}
				for (const childNode of node.children) {
					visitNode(childNode);
				}
				text += '}\n';
			}
		}
	};
}

function wrapTsIgnores(content: string, dontIgnoreFirstLine = false) {
	if (content.indexOf('\n') === -1)
		return content;
	return content
		.split('\n')
		.map((line, i) => !dontIgnoreFirstLine && i === 0 ? line : `// @ts-ignore\n${line}`)
		.join('\n');
}
