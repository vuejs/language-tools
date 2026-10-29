<script setup lang="ts">
const local = 1;
</script>

<template>
	{{ local }}
	{{ $foo.toFixed() }}
	{{ $foo.nope }}
</template>
