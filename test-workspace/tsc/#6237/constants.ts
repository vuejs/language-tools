import { ref } from 'vue';

export const SOME_CONST = {
	A: 'A',
} as const;

export const SOME_REF = ref(SOME_CONST);
