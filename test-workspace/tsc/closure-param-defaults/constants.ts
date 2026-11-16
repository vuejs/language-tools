import { computed, ref } from 'vue';

export enum Mode {
	A,
	B,
}

export const options = { mode: Mode.A };
export const count = ref(0);
export const object = { locale: { value: 'en' } };
export const maybe = ref<string | undefined>();
export const readonlyCount = computed(() => 1);
