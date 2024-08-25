<script setup lang="ts">
import { exactType } from '../../shared';

interface Props {
	actionText?: string;
}

withDefaults(defineProps<Props>(), {
	actionText: "foo",
});
</script>

<template>
	<div>
		{{ exactType(actionText, {} as string) }}
		{{ exactType($props.actionText, {} as string | undefined) }}
	</div>
</template>
