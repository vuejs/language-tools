import { ref } from 'vue';

export enum Mode {
	A,
	B,
}

export const options = { mode: Mode.A };
export const count = ref(0);
