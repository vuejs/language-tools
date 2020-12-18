import * as htmlparser2 from 'htmlparser2';
import { Node, DataNode, Element } from 'domhandler';
import { ElementType } from 'domelementtype';
import * as prettyhtml from '@starptech/prettyhtml';

let pugLoader: (source: string) => string = require('pug-plain-loader');
pugLoader = pugLoader.bind({ addDependency: () => { } }); // patch loader

const tabSize = 2;
const useTabs = false;

export function pugToHtml(pugCode: string) {
	pugCode = pugCode.replace(/\/\/-/g, '// ')
	let htmlCode = pugLoader(pugCode);
	htmlCode = htmlCode.replace(/\-\-\>/g, " -->");

	// TODO
	htmlCode = htmlCode
		.replace(/&gt;/g, `>`)
		.replace(/&lt;/g, `<`)
		.replace(/&amp;/g, `&`)
		.replace(/&quot;/g, `"`)

	// make html pug mapping correct, let pug mutli-line interpolations work.
	htmlCode = prettyhtml(htmlCode, { tabWidth: tabSize, useTabs: useTabs }).contents;
	const mapper = createHtmlPugMapper(pugCode, htmlCode);
	const htmlLines = htmlCode.split('\n');
	let htmlOffset = 0;
	let newHtmlCode = '';
	for (const htmlLine of htmlLines) {
		const htmlLineTrimed = htmlLine.trimStart();
		htmlOffset += htmlLine.length - htmlLineTrimed.length;
		const pugOffset = mapper(htmlOffset, htmlOffset + htmlLineTrimed.length)
		htmlOffset += htmlLineTrimed.length + 1; // +1 is \n
		if (pugOffset) {
			let pugTrimed = '';
			for (let i = pugOffset - 1; i >= 0 && ['\t', ' '].includes(pugCode[i]); i--) {
				pugTrimed = pugCode[i] + pugTrimed;
			}
			newHtmlCode += pugTrimed + htmlLineTrimed + '\n';
		}
		else {
			newHtmlCode += htmlLine + '\n';
		}
	}

	return newHtmlCode.trim();
}
export function htmlToPug(html: string) {
	let nodes = htmlparser2.parseDOM(html, {
		xmlMode: false,
		lowerCaseTags: false,
		lowerCaseAttributeNames: false,
		recognizeSelfClosing: true,
	});
	nodes = filterEmptyTextNodes(nodes);
	let pug = '';
	for (const node of nodes) {
		worker(node, false);
	}
	return pug;

	function createIndent(useTabs: boolean, tabSize: number, indent: number) {
		return useTabs ? '\t'.repeat(indent) : ' '.repeat(indent * tabSize);
	}
	function getIndent(indent: number) {
		return createIndent(useTabs, tabSize, indent);
	}
	function worker(node: Node, inlineChild: boolean, indent: number = 0) {
		if (node.type === ElementType.Text) {
			const dataNode = node as DataNode;
			// single line
			if (dataNode.data.indexOf('\n') === -1) {
				if (inlineChild) {
					pug += ' ' + dataNode.data;
				}
				else {
					pug += '\n' + getIndent(indent) + '| ' + dataNode.data;
				}
			}
			// mutli-line
			else {
				pug += '\n' + getIndent(indent) + '.';
				for (const line of dataNode.data.split('\n')) {
					pug += '\n' + getIndent(indent + 1) + line.trim();
				}
			}
		}
		else if (node.type === ElementType.Tag) {
			const element = node as Element;
			let code = element.name;
			const atts: string[] = [];
			for (const att in element.attribs) {
				let val = element.attribs[att];
				if (val === '') {
					atts.push(`${att}`);
				}
				else if (val.indexOf('\n') === -1) {
					atts.push(`${att}="${val}"`);
				}
				else {
					val = val.replace(/\`/g, '\\`');
					atts.push(`${att}=\`${val}\``);
				}
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
				const text = dataNode.data.trim();
				if (text === '') continue;
				newNodes.push(new DataNode(
					ElementType.Text,
					text,
				));
			}
			else {
				newNodes.push(node);
			}
		}

		return newNodes;
	}
}
export function createHtmlPugMapper(pug: string, html: string) {
	const cache = new Map<string, { htmlOffsets: number[], pugOffset: number[] }>();
	html = removeEndTags(html);

	return searchPugOffset;

	function removeEndTags(template: string) {
		return template.replace(/\<\/[^\>]*\>/g, s => ' '.repeat(s.length));
	}
	function searchPugOffset(htmlStart: number, htmlEnd: number) {
		const code = html.substring(htmlStart, htmlEnd);

		if (!cache.has(code)) {
			cache.set(code, {
				htmlOffsets: getMatchOffsets(html, code),
				pugOffset: getMatchOffsets(pug, code),
			});
		}
		const { htmlOffsets, pugOffset } = cache.get(code)!;

		if (htmlOffsets.length === pugOffset.length) {
			const matchIndex = htmlOffsets.indexOf(htmlStart);
			if (matchIndex >= 0) {
				return pugOffset[matchIndex];
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
