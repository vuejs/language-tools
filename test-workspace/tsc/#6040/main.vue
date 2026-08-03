<script setup lang="ts" generic="TGroup extends {}, TGroups extends Record<string, TGroup> = Record<string, TGroup>">
import { exactType } from "../shared";

const props = defineProps<{
	groups: TGroups;
}>();

for (const [type, group] of Object.entries(props.groups)) {
	exactType(group, {} as TGroup);
	exactType(type, {} as string);
}
</script>

<template>
	<template v-for="(group, type) of groups" :key="type">
		{{ exactType(group, {} as TGroup) }}
		{{ exactType(type, {} as string) }}
	</template>
</template>
