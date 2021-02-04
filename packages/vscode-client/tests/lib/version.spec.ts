import { isVolarProject, isVueProject } from "../../lib/version";

const invalidPackageJson = `
{
  "scripts": {
  },
}
`;
const noVuePackageJson = `
{
  "dependencies": {
  }
}
`;
const latestVuePackageJson = `
{
  "dependencies": {
    "vue": "latest"
  }
}
`;
const vue3PackageJson = `
{
  "devDependencies": {
    "vue": "^3.1.0"
  }
}
`;
const vue3DevPackageJson = `
{
  "devDependencies": {
    "vue": "^3.1.0"
  }
}
`;
const vue2PackageJson = `
{
  "devDependencies": {
    "vue": "^2.6.0"
  }
}
`;
const vue2WithRuntimePackageJson = `
{
  "dependencies": {
    "vue": "^2.6.0"
  },
  "devDependencies": {
    "@vue/runtime-dom": "latest"
  }
}
`;
describe("isVolarProject", () => {
  it("should return true if pass a invalidJson", () => {
    expect(isVolarProject(invalidPackageJson)).toBe(true);
  });
  it("should return false if not install vue", () => {
    expect(isVolarProject(noVuePackageJson)).toBe(false);
  });
  it("should return true if install latest vue", () => {
    expect(isVolarProject(latestVuePackageJson)).toBe(true);
  });
  it('should return true if install vue 3.x', () => {
    expect(isVolarProject(vue3PackageJson)).toBe(true);
  });
  it('should return true if install vue 3.x in dependencies', () => {
    expect(isVolarProject(vue3DevPackageJson)).toBe(true);
  });
  it('should return false if install vue2.x and without runtime dom', () => {
    expect(isVolarProject(vue2PackageJson)).toBe(false);
  })
  it('should return true if install vue2.x and runtime dom', () => {
    expect(isVolarProject(vue2WithRuntimePackageJson)).toBe(true);
  })
});
