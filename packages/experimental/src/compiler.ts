import type VitePlugin from '@vitejs/plugin-vue';

export const vitePluginOptions: NonNullable<Parameters<typeof VitePlugin>[0]> = {
	template: {
		compilerOptions: {
			nodeTransforms: [
				(node, ctx) => {
					if (node.type === 1) {
						const { offset: start } = node.loc.start;
						const { offset: end } = node.loc.end;
						(node as any).props.push(
							{
								type: 6,
								name: 'data-loc',
								value: {
									content: `[${start},${end}]`,
								},
								loc: node.loc,
							},
							{
								type: 7,
								name: 'on',
								exp: {
									type: 4,
									content: '$volar.goToTemplate($.type.__file, $event.target.dataset.loc); $volar.highlight($event.target);',
									isStatic: false,
									constType: 0,
									loc: node.loc,
								},
								arg: {
									type: 4,
									content: 'mouseenter',
									isStatic: true,
									constType: 3,
									loc: node.loc,
								},
								modifiers: [],
								loc: node.loc,
							},
							{
								type: 7,
								name: 'on',
								exp: {
									type: 4,
									content: '$volar.unHighlight()',
									isStatic: false,
									constType: 0,
									loc: node.loc,
								},
								arg: {
									type: 4,
									content: 'mouseleave',
									isStatic: true,
									constType: 3,
									loc: node.loc,
								},
								modifiers: [],
								loc: node.loc,
							},
						);
					}
				}
			]
		}
	}
}
