import * as pug from 'pug';
import * as htmlparser2 from 'htmlparser2';
import { Node, DataNode, Element } from 'domhandler';
import { ElementType } from 'domelementtype';

export function pugToHtml(html: string) {
	const template = pug.compile(html);

	// TODO
	return template()
		.replace(/&gt;/g, `>`)
		.replace(/&lt;/g, `<`)
		.replace(/&amp;/g, `&`)
		.replace(/&quot;/g, `"`)
}
export function htmlToPug(html: string, tabSize: number, useTabs: boolean) {
	let nodes = htmlparser2.parseDOM(html, {
		xmlMode: true
	});
	nodes = filterEmptyTextNodes(nodes);
	let pug = '';

	for (const node of nodes) {
		worker(node, false);
	}

	function getIndent(indent: number) {
		return useTabs ? '\t'.repeat(indent) : ' '.repeat(indent * tabSize);
	}
	function worker(node: Node, inlineChild: boolean, indent: number = 0) {
		if (node.type === ElementType.Text) {
			const dataNode = node as DataNode;
			if (inlineChild) {
				pug += ' ' + dataNode.data;
			}
			else {
				pug += '\n' + getIndent(indent) + '| ' + dataNode.data;
			}
		}
		else if (node.type === ElementType.Tag) {
			const element = node as Element;
			let code = element.name;
			const atts: string[] = [];
			for (const att in element.attribs) {
				// remove newline in att
				let val = element.attribs[att]
					.split('\n')
					.map(s => s.trim())
					.join(' ');

				if (val)
					atts.push(`${att}='${val}'`);
				else
					atts.push(`${att}=''`);
			}
			if (atts.length > 0) {
				code += `(${atts.join(', ')})`;
			}
			pug += '\n' + getIndent(indent) + code;
			const childs = filterEmptyTextNodes(element.children);
			for (let i = 0; i < childs.length; i++) {
				const childNode = childs[i];
				const inlineChild = i === 0 && atts.length === 0;
				worker(childNode, inlineChild, indent + 1);
			}
		}
		else if (node.type === ElementType.Comment) {
			const dataNode = node as DataNode;
			const lines = dataNode.data.split('\n')
				.map(s => s.trim());

			// multi-line
			if (lines.length >= 2) {
				pug += '\n' + getIndent(indent) + '//';
				for (const line of lines) {
					pug += '\n' + getIndent(indent + 1) + line;
				}
			}
			// single line
			else {
				for (const line of lines) {
					pug += '\n' + getIndent(indent) + '// ' + line;
				}
			}
		}
		return pug;
	}
	function filterEmptyTextNodes(nodes: Node[]) {
		const newNodes: Node[] = [];

		for (const node of nodes) {
			if (node.type === ElementType.Text) {
				const dataNode = node as DataNode;

				// remove newline in {{ ... }}
				const data = dataNode.data.replace(
					/\{\{(.*\n.*)+\}\}/g,
					match => match.split('\n').map(s => s.trim()).join('')
				);

				const strs = data
					// .replace(/\{\{.*\}\}/gs, match => match.replace(/\n/g, ' '))
					.split('\n')
					.map(s => s.trim())
					.filter(s => s !== '');

				for (const str of strs) {
					const newNode = new DataNode(
						ElementType.Text,
						str,
					);
					newNodes.push(newNode);
				}
			}
			else {
				newNodes.push(node);
			}
		}

		return newNodes;
	}

	return pug;
}
export function createHtmlPugMapper(pug: string, html: string) {
	html = removeEndTags(html);

	return searchPugOffset;

	function removeEndTags(template: string) {
		return template.replace(/\<\/[^\>]*\>/g, s => ' '.repeat(s.length));
	}
	function searchPugOffset(code: string, htmlOffset: number) {
		const htmlMatches = getMatchOffsets(html, code);
		const pugMatches = getMatchOffsets(pug, code);
	
		if (htmlMatches.length === pugMatches.length) {
			const matchIndex = htmlMatches.indexOf(htmlOffset);
			if (matchIndex >= 0) {
				return pugMatches[matchIndex];
			}
		}
	}
	function toUnicode(theString: string) {
		let unicodeString = '';
		for (let i = 0; i < theString.length; i++) {
			let theUnicode = theString.charCodeAt(i).toString(16).toUpperCase();
			while (theUnicode.length < 4) {
				theUnicode = '0' + theUnicode;
			}
			theUnicode = '\\u' + theUnicode;
			unicodeString += theUnicode;
		}
		return unicodeString;
	}
	function getMatchOffsets(sourceString: string, regexPattern: string) {
		if (regexPattern.length === 0) return [];

		regexPattern = toUnicode(regexPattern);
		let regexPatternWithGlobal = RegExp(regexPattern, 'gs')
		return getMatchOffsetsRegExp(sourceString, regexPatternWithGlobal);
	}
	function getMatchOffsetsRegExp(sourceString: string, regex: RegExp) {
		let output: number[] = []
		let match: RegExpExecArray | null;
		while (match = regex.exec(sourceString)) {
			output.push(match.index);
		}
		return output
	}
}
