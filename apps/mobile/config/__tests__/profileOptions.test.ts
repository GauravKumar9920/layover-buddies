import {
  NATIONALITY_OPTIONS,
  canonicalNationality,
} from "@/config/profileOptions";

describe("NATIONALITY_OPTIONS", () => {
  it("has no duplicate names — a duplicate would render two identical rows", () => {
    const names = NATIONALITY_OPTIONS.map((option) => option.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("has no duplicate codes — FlatList keys them", () => {
    const codes = NATIONALITY_OPTIONS.map((option) => option.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("still contains the countries the old short list offered", () => {
    const names = NATIONALITY_OPTIONS.map((option) => option.name);
    for (const expected of [
      "United States",
      "United Kingdom",
      "Germany",
      "France",
      "Japan",
      "Australia",
      "Canada",
      "Singapore",
      "United Arab Emirates",
      "India",
      "Italy",
      "Spain",
      "Netherlands",
      "South Korea",
      "Brazil",
    ]) {
      expect(names).toContain(expected);
    }
  });

  it("gives every entry a flag", () => {
    for (const option of NATIONALITY_OPTIONS) {
      expect(option.flag.length).toBeGreaterThan(0);
    }
  });
});

describe("canonicalNationality", () => {
  it("maps the legacy short-list label forward", () => {
    expect(canonicalNationality("UAE")).toBe("United Arab Emirates");
  });

  it("passes through a name that is already canonical", () => {
    expect(canonicalNationality("Japan")).toBe("Japan");
  });

  it("preserves an unrecognised value rather than blanking the profile", () => {
    expect(canonicalNationality("Atlantis")).toBe("Atlantis");
  });

  it("treats empty and missing as unset", () => {
    expect(canonicalNationality(null)).toBeNull();
    expect(canonicalNationality(undefined)).toBeNull();
    expect(canonicalNationality("")).toBeNull();
  });
});
