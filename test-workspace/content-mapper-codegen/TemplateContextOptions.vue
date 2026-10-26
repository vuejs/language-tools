<script lang="ts">
export default {
	data: () => ({ local: 1 }),
};
</script>

<template>
	{{ local }}
	{{ $foo.toFixed() }}
	{{ $foo.nope }}
</template>
