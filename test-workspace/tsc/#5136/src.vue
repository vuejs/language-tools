<script setup lang="ts">
import { useCssModule } from 'vue';
import { exactType } from '../shared';

const $src = useCssModule("$src");
exactType($src, {} as Record<string, string> & {
	foo: string;
});

const $import = useCssModule("$import");
exactType($import, {} as Record<string, string> & {
	foo: string;
	bar: string;
});
</script>

<style module="$src" src="./main.css"></style>

<style module="$import">
@import "./main.css";

.bar { }
</style>
