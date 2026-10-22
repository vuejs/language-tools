/** The runtime values used from TypeScript 7: its `typescript/ast` and `typescript/async` modules merged. */
export type TypeScript =
	& typeof import('typescript-7/ast', { with: { 'resolution-mode': 'import' }})
	& typeof import('typescript-7/async', { with: { 'resolution-mode': 'import' }});

let ts: Promise<TypeScript> | undefined;

export function loadTypeScript() {
	return ts ??= (async () => ({
		...await import('typescript-7/ast'),
		...await import('typescript-7/async'),
	}))();
}
