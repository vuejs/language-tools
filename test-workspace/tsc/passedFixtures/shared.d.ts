// https://stackoverflow.com/a/53808212
type IfEquals<T, U, Y = unknown, N = never> =
	(<G>() => G extends T ? 1 : 2) extends
	(<G>() => G extends U ? 1 : 2) ? Y : N;
export declare function exactType<T, U>(draft: T & IfEquals<T, U>, expected: U & IfEquals<T, U>): IfEquals<T, U>;
