const fs = require("fs");
const path = require("path");

const file = `{
  "dependencies": {
  }
}`
const parsed = JSON.parse(file)

const semver = require("semver")
const vueVersion = parsed['dependencies']['vue'] || parsed['devDependencies']['vue'] || ''
console.log(vueVersion)
console.log(semver.compare('3.0.0', semver.minVersion(vueVersion)))
