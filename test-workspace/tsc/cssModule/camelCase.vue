<!-- @cssModulesLocalsConvention "camelCase" -->

<script lang="ts" setup>
import { useCssModule } from 'vue';
import { exactType } from '../shared';

const style = useCssModule();
exactType(style, {} as Record<string, string> & {
    fooBar: string;
    'foo_bar': string;
});
</script>

<style module>
.foo_bar {}
</style>
