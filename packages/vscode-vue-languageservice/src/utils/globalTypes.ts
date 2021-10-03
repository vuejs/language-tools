export const code = `
declare module '@vue/runtime-dom' {
	export interface HTMLAttributes extends Record<string, unknown> { }
	export interface SVGAttributes extends Record<string, unknown> { }
}

declare global {
	namespace JSX {
		interface IntrinsicAttributes extends Record<string, unknown> { }
	}
}

export {}
`;
