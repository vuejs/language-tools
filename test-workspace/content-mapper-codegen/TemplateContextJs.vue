<script setup>
const local = 1;
</script>

<template>
	{{ local }}
	{{ $foo.toFixed() }}
	{{ $foo.nope }}
</template>
