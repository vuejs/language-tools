import { ref } from 'vue';

export enum Mode {
	Regular = 'regular',
	Editing = 'editing',
}

export const enum ConstMode {
	Regular = 'regular',
	Editing = 'editing',
}

export const options = { mode: Mode.Regular };
export const state = ref({ mode: Mode.Regular });
export const count = ref(0);
