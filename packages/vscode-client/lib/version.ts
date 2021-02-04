import semver from "semver";

/**
 *
 * a volar project is a vue3 project or a vue2 project with "@vue/runtime-dom" installed
 * @export
 * @param {string} packageJson
 * @returns {boolean}
 */
export function isVolarProject(packageJson: string): boolean {
  try {
    const parsed = JSON.parse(packageJson);
    const vueVersion = parsed["dependencies"]?.["vue"] || parsed["devDependencies"]?.["vue"] || "";
    if (!vueVersion) {
      return false;
    } else if (vueVersion === "latest") {
      // we are pretty sure that vue version is biggerEqual than 3.0.0
      // except the project has never install anything since they used 2.x vue
      return true;
    }

    if (semver.compare(semver.minVersion(vueVersion), "3.0.0") === -1) {
      // 2.x vue
      return !!(parsed["devDependencies"]?.["@vue/runtime-dom"] || parsed["dependencies"]?.["@vue/runtime-dom"]);
    }
    return true;
  } catch (err) {
    // the only error would came from are `JSON.parse` and semver parse ,
    // that means though it's not a valid package.json but it still possible is a VolarProject
    return true;
  }
}

/**
 *
 *
 * @export
 * @param {string} packageJson packageJson file
 * @returns {boolean}
 */
export function isVueProject(packageJson: string): boolean {
  try {
    const parsed = JSON.parse(packageJson);
    const vueVersion = parsed["dependencies"]["vue"] || parsed["devDependencies"]["vue"] || "";
    return !!vueVersion;
  } catch (e) {
    return false;
  }
}
