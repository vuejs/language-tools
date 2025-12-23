<!-- @cssModulesLocalsConvention "dashes" -->

<script lang="ts" setup>
import { useCssModule } from 'vue';
import { exactType } from '../shared';

const style = useCssModule();
exactType(style, {} as Record<string, string> & {
    'foo-bar': string;
    fooBar: string;
    bar_baz: string;
});
</script>

<style module>
.foo-bar {}

.bar_baz {}
</style>
