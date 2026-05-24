<script lang="ts" src="./typescript.ts"></script>

<template>
	{{ foo }}
	<!-- @vue-expect-error -->
	{{ bar }}
</template>
