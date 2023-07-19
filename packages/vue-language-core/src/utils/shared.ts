export function getSlotsPropertyName(vueVersion: number) {
	return vueVersion < 3 ? '$scopedSlots' : '$slots';
}
