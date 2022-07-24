export interface MyEvents {
	(event: 'foo', data: { foo: string; }): void;
	(event: 'bar', arg1: number, arg2?: any): void;
	(event: 'baz'): void;
}
