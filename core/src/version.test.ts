import { VERSION } from "./version";

describe("VERSION", () => {
  it("should be defined", () => {
    expect(VERSION).toBeDefined();
  });

  it("should be a string", () => {
    expect(typeof VERSION).toBe("string");
  });

  it("should follow semver format", () => {
    const semverRegex = /^\d+\.\d+\.\d+$/;
    expect(VERSION).toMatch(semverRegex);
  });
});
