import { describe, expect, it } from "vitest";

function normalizeEmail(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function normalizePhone(value: string | null | undefined): string {
  const digits = (value ?? "").replace(/\D/g, "");
  if (digits.length <= 10) return digits;
  return digits.slice(-10);
}

function normalizeNamePart(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function getPairKey(contactAId: string, contactBId: string): string {
  return contactAId < contactBId
    ? `${contactAId}:${contactBId}`
    : `${contactBId}:${contactAId}`;
}

function setsIntersect(left: Set<string>, right: Set<string>): boolean {
  if (left.size === 0 || right.size === 0) return false;
  const [smallSet, largeSet] = left.size <= right.size ? [left, right] : [right, left];
  for (const value of smallSet) {
    if (largeSet.has(value)) return true;
  }
  return false;
}

interface ProcessedContact {
  id: string;
  firstName: string | null;
  lastName: string | null;
  nickname: string | null;
  externalIdentityKeys: Set<string>;
  emailValues: Set<string>;
  phoneValues: Set<string>;
  firstNameNormalized: string;
  lastNameNormalized: string;
  fullNameNormalized: string;
}

function getNameSimilarityScore(
  contactA: ProcessedContact,
  contactB: ProcessedContact,
): { score: number; reason: string | null } {
  if (!contactA.fullNameNormalized || !contactB.fullNameNormalized) {
    return { score: 0, reason: null };
  }

  if (contactA.fullNameNormalized === contactB.fullNameNormalized) {
    return { score: 80, reason: "name_exact" };
  }

  const sameFirstName =
    contactA.firstNameNormalized.length > 0 &&
    contactA.firstNameNormalized === contactB.firstNameNormalized;
  const lastPrefixA = contactA.lastNameNormalized.slice(0, 3);
  const lastPrefixB = contactB.lastNameNormalized.slice(0, 3);
  const similarLastNamePrefix =
    lastPrefixA.length === 3 &&
    lastPrefixB.length === 3 &&
    lastPrefixA === lastPrefixB;

  if (sameFirstName && similarLastNamePrefix) {
    return { score: 70, reason: "name_similar_lastname_prefix" };
  }

  const isReversed =
    contactA.firstNameNormalized.length > 0 &&
    contactA.lastNameNormalized.length > 0 &&
    contactA.firstNameNormalized === contactB.lastNameNormalized &&
    contactA.lastNameNormalized === contactB.firstNameNormalized;

  if (isReversed) {
    return { score: 65, reason: "name_reversed" };
  }

  return { score: 0, reason: null };
}

function evaluatePair(
  contactA: ProcessedContact,
  contactB: ProcessedContact,
): { score: number; reasons: string[] } | null {
  const matches: Array<{ score: number; reason: string }> = [];

  if (setsIntersect(contactA.externalIdentityKeys, contactB.externalIdentityKeys)) {
    matches.push({ score: 95, reason: "external_identity" });
  }

  if (setsIntersect(contactA.emailValues, contactB.emailValues)) {
    matches.push({ score: 90, reason: "email" });
  }

  if (setsIntersect(contactA.phoneValues, contactB.phoneValues)) {
    matches.push({ score: 85, reason: "phone" });
  }

  const nameMatch = getNameSimilarityScore(contactA, contactB);
  if (nameMatch.score > 0 && nameMatch.reason) {
    matches.push({ score: nameMatch.score, reason: nameMatch.reason });
  }

  const score = matches.reduce((max, match) => Math.max(max, match.score), 0);
  if (score < 60) return null;

  return {
    score,
    reasons: matches.map((match) => match.reason),
  };
}

function makeContact(overrides: Partial<ProcessedContact> = {}): ProcessedContact {
  const firstName = overrides.firstName ?? null;
  const lastName = overrides.lastName ?? null;
  const firstNameNormalized =
    overrides.firstNameNormalized ?? normalizeNamePart(firstName);
  const lastNameNormalized =
    overrides.lastNameNormalized ?? normalizeNamePart(lastName);
  const fullNameNormalized =
    overrides.fullNameNormalized ??
    [firstNameNormalized, lastNameNormalized].filter(Boolean).join(" ");

  return {
    id: overrides.id ?? "contact-id",
    firstName,
    lastName,
    nickname: overrides.nickname ?? null,
    externalIdentityKeys: overrides.externalIdentityKeys ?? new Set<string>(),
    emailValues: overrides.emailValues ?? new Set<string>(),
    phoneValues: overrides.phoneValues ?? new Set<string>(),
    firstNameNormalized,
    lastNameNormalized,
    fullNameNormalized,
  };
}

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Test.User@Example.COM ")).toBe("test.user@example.com");
  });

  it("handles null and undefined as empty string", () => {
    expect(normalizeEmail(null)).toBe("");
    expect(normalizeEmail(undefined)).toBe("");
  });

  it("preserves already valid email", () => {
    expect(normalizeEmail("person@example.org")).toBe("person@example.org");
  });
});

describe("normalizePhone", () => {
  it("strips non-digit characters", () => {
    expect(normalizePhone("(718) 555-1234")).toBe("7185551234");
  });

  it("keeps only the last 10 digits for long numbers", () => {
    expect(normalizePhone("+1 718 555 1234")).toBe("7185551234");
  });

  it("keeps short numbers as-is", () => {
    expect(normalizePhone("5551234")).toBe("5551234");
  });

  it("handles null as empty string", () => {
    expect(normalizePhone(null)).toBe("");
  });
});

describe("getPairKey", () => {
  it("always returns a sorted key", () => {
    expect(getPairKey("a", "b")).toBe("a:b");
    expect(getPairKey("b", "a")).toBe("a:b");
  });

  it("is idempotent regardless of argument order", () => {
    const leftToRight = getPairKey("contact-2", "contact-1");
    const rightToLeft = getPairKey("contact-1", "contact-2");
    expect(leftToRight).toBe(rightToLeft);
  });
});

describe("setsIntersect", () => {
  it("returns false when either set is empty", () => {
    expect(setsIntersect(new Set<string>(), new Set<string>())).toBe(false);
    expect(setsIntersect(new Set<string>(["x"]), new Set<string>())).toBe(false);
  });

  it("returns false when there is no overlap", () => {
    expect(setsIntersect(new Set<string>(["a", "b"]), new Set<string>(["c", "d"]))).toBe(false);
  });

  it("returns true when there is overlap", () => {
    expect(setsIntersect(new Set<string>(["a", "b"]), new Set<string>(["b", "c"]))).toBe(true);
  });

  it("works with different set sizes", () => {
    const small = new Set<string>(["needle"]);
    const large = new Set<string>(["a", "b", "c", "needle", "z"]);
    expect(setsIntersect(small, large)).toBe(true);
    expect(setsIntersect(large, small)).toBe(true);
  });
});

describe("getNameSimilarityScore", () => {
  it("returns 80 for exact full name match", () => {
    const a = makeContact({ firstName: "John", lastName: "Doe" });
    const b = makeContact({ firstName: "John", lastName: "Doe" });
    expect(getNameSimilarityScore(a, b)).toEqual({ score: 80, reason: "name_exact" });
  });

  it("returns 70 for same first name and similar last-name prefix", () => {
    const a = makeContact({ firstName: "John", lastName: "Anderson" });
    const b = makeContact({ firstName: "John", lastName: "Andrews" });
    expect(getNameSimilarityScore(a, b)).toEqual({
      score: 70,
      reason: "name_similar_lastname_prefix",
    });
  });

  it("returns 65 for reversed first and last names", () => {
    const a = makeContact({ firstName: "Jane", lastName: "Smith" });
    const b = makeContact({ firstName: "Smith", lastName: "Jane" });
    expect(getNameSimilarityScore(a, b)).toEqual({ score: 65, reason: "name_reversed" });
  });

  it("returns 0 for completely different names", () => {
    const a = makeContact({ firstName: "Alice", lastName: "Brown" });
    const b = makeContact({ firstName: "Charlie", lastName: "Davis" });
    expect(getNameSimilarityScore(a, b)).toEqual({ score: 0, reason: null });
  });

  it("returns 0 when one or both names are empty", () => {
    const a = makeContact({ firstName: "", lastName: "" });
    const b = makeContact({ firstName: "John", lastName: "Doe" });
    expect(getNameSimilarityScore(a, b)).toEqual({ score: 0, reason: null });
    expect(getNameSimilarityScore(a, a)).toEqual({ score: 0, reason: null });
  });
});

describe("evaluatePair", () => {
  it("returns score 95 for external identity match", () => {
    const a = makeContact({ externalIdentityKeys: new Set<string>(["crm:1"]) });
    const b = makeContact({ externalIdentityKeys: new Set<string>(["crm:1"]) });
    expect(evaluatePair(a, b)).toMatchObject({ score: 95 });
  });

  it("returns score 90 for email match", () => {
    const a = makeContact({ emailValues: new Set<string>(["test@example.com"]) });
    const b = makeContact({ emailValues: new Set<string>(["test@example.com"]) });
    expect(evaluatePair(a, b)).toMatchObject({ score: 90 });
  });

  it("returns score 85 for phone match", () => {
    const a = makeContact({ phoneValues: new Set<string>(["7185551234"]) });
    const b = makeContact({ phoneValues: new Set<string>(["7185551234"]) });
    expect(evaluatePair(a, b)).toMatchObject({ score: 85 });
  });

  it("returns score 80 for exact name match", () => {
    const a = makeContact({ firstName: "John", lastName: "Doe" });
    const b = makeContact({ firstName: "John", lastName: "Doe" });
    expect(evaluatePair(a, b)).toMatchObject({ score: 80 });
  });

  it("returns null when score is below 60", () => {
    const a = makeContact({ firstName: "A", lastName: "B" });
    const b = makeContact({ firstName: "C", lastName: "D" });
    expect(evaluatePair(a, b)).toBeNull();
  });

  it("uses the highest score when multiple signals match", () => {
    const a = makeContact({
      firstName: "John",
      lastName: "Doe",
      emailValues: new Set<string>(["test@example.com"]),
    });
    const b = makeContact({
      firstName: "John",
      lastName: "Doe",
      emailValues: new Set<string>(["test@example.com"]),
    });

    const result = evaluatePair(a, b);
    expect(result).not.toBeNull();
    expect(result).toMatchObject({ score: 90 });
  });
});
