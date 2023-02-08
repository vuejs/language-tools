export function getSlotsPropertyName(vueVersion: number) {
	return vueVersion < 3 ? '$scopedSlots' : '$slots';
}

export function getVueLibraryName(vueVersion: number) {
	return vueVersion < 2.7 ? '@vue/runtime-dom' : 'vue';
}
