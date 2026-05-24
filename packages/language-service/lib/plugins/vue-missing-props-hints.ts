import type { InlayHint, InlayHintKind, LanguageServicePlugin } from '@volar/language-service';
import type * as CompilerDOM from '@vue/compiler-dom';
import { forEachElementNode, getElementTagOffsets, hyphenateAttr } from '@vue/language-core';
import { AttrNameCasing, getAttrNameCasing } from '../nameCasing';
import { resolveEmbeddedCode } from '../utils';

export function create(
	{ getComponentProps }: import('@vue/typescript-plugin/lib/requests').Requests,
): LanguageServicePlugin {
	return {
		name: 'vue-missing-props-hints',
		capabilities: {
			inlayHintProvider: {},
		},
		create(context) {
			return {
				async provideInlayHints(document, range, cancellationToken) {
					const info = resolveEmbeddedCode(context, document.uri);
					if (info?.code.id !== 'template') {
						return;
					}

					const enabled = await context.env.getConfiguration<boolean>?.('vue.inlayHints.missingProps') ?? false;
					if (!enabled) {
						return;
					}

					const { template } = info.root.ir;
					if (!template?.ast) {
						return;
					}

					const result: InlayHint[] = [];
					const attrNameCasing = await getAttrNameCasing(context, info.script.id);
					const map = context.language.maps.get(info.code, info.script);

					for (const node of forEachElementNode(template.ast)) {
						if (cancellationToken.isCancellationRequested) {
							break;
						}

						if (node.tagType !== 1 satisfies CompilerDOM.ElementTypes.COMPONENT) {
							continue;
						}

						const [startTagOffset] = getElementTagOffsets(node, template);
						const sourceOffset = startTagOffset + node.tag.length;

						let generatedOffset: number | undefined;
						for (const [offset] of map.toGeneratedLocation(template.startTagEnd + sourceOffset)) {
							generatedOffset = offset;
							break;
						}
						if (
							generatedOffset === undefined
							|| generatedOffset < document.offsetAt(range.start)
							|| generatedOffset > document.offsetAt(range.end)
						) {
							continue;
						}

						const props = await getComponentProps(info.root.fileName, node.loc.start.offset) ?? [];
						const missingProps = new Map(
							props.filter(prop => !prop.optional).map(prop => [hyphenateAttr(prop.name), prop.name]),
						);

						for (const prop of node.props) {
							if (prop.type === 6 satisfies CompilerDOM.NodeTypes.ATTRIBUTE) {
								missingProps.delete(hyphenateAttr(prop.name));
							}
							else if (prop.type === 7 satisfies CompilerDOM.NodeTypes.DIRECTIVE) {
								if (prop.name === 'bind') {
									if (prop.arg?.type === 4 satisfies CompilerDOM.NodeTypes.SIMPLE_EXPRESSION && prop.arg.isStatic) {
										missingProps.delete(hyphenateAttr(prop.arg.content));
									}
									else if (!prop.arg) {
										missingProps.clear();
									}
								}
								else if (prop.name === 'model') {
									if (prop.arg?.type === 4 satisfies CompilerDOM.NodeTypes.SIMPLE_EXPRESSION && prop.arg.isStatic) {
										missingProps.delete(hyphenateAttr(prop.arg.content));
										missingProps.delete('on-update:' + hyphenateAttr(prop.arg.content));
									}
									else if (!prop.arg) {
										missingProps.delete('model-value');
										missingProps.delete('on-update:model-value');
									}
								}
								else if (prop.name === 'on') {
									if (prop.arg?.type === 4 satisfies CompilerDOM.NodeTypes.SIMPLE_EXPRESSION && prop.arg.isStatic) {
										missingProps.delete('on-' + hyphenateAttr(prop.arg.content));
									}
								}
							}
						}

						for (const name of missingProps.values()) {
							result.push({
								label: name,
								paddingLeft: true,
								position: document.positionAt(generatedOffset),
								kind: 2 satisfies typeof InlayHintKind.Parameter,
								textEdits: [{
									range: {
										start: document.positionAt(generatedOffset),
										end: document.positionAt(generatedOffset),
									},
									newText: ` :${attrNameCasing === AttrNameCasing.Kebab ? hyphenateAttr(name) : name}=`,
								}],
							});
						}
					}

					return result;
				},
			};
		},
	};
}
