import { computed, ref } from 'vue';

export const object = { locale: { value: 'en' } };
export enum Role {
	Admin = 'admin',
}
export const maybe = ref<string | undefined>();
export const count = ref(0);
export const readonlyCount = computed(() => 1);
