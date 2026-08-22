import { describe, expect, it } from "vitest";
import { PHOTO_BRIEFS, photoBrief, photoCredit, unsourcedSlugs } from "./photography";
import { MENU_ITEMS } from "./menu";

/**
 * The manifest is only useful if it cannot drift from the menu. A dish added
 * without a brief would quietly ship with no photograph and no record of what
 * it should show; a brief pointing at a file the menu never requests would send
 * someone out to shoot something nothing displays.
 */
describe("photography manifest", () => {
  it("briefs every dish on the menu", () => {
    for (const item of MENU_ITEMS) {
      expect(photoBrief(item.slug), `no photo brief for "${item.name}"`).not.toBeNull();
    }
  });

  it("briefs nothing that is not on the menu", () => {
    const slugs = new Set(MENU_ITEMS.map((item) => item.slug));
    for (const entry of PHOTO_BRIEFS) {
      expect(slugs.has(entry.slug), `brief for unknown dish "${entry.slug}"`).toBe(true);
    }
  });

  it("points each brief at the exact file the menu asks for", () => {
    for (const item of MENU_ITEMS) {
      const entry = photoBrief(item.slug)!;
      expect(`/menu/${entry.file}`, item.name).toBe(item.image.src);
    }
  });

  it("gives every dish alt text that describes the food", () => {
    for (const item of MENU_ITEMS) {
      expect(item.image.alt.length, item.name).toBeGreaterThan(12);
      // Alt text describes the dish, not the file or the medium.
      expect(item.image.alt.toLowerCase(), item.name).not.toMatch(
        /image|photo|picture|placeholder|\.jpg/,
      );
    }
  });

  it("never briefs a shot containing an ingredient the dish does not have", () => {
    // Paid extras and optional add-ons must not appear in the photograph, or the
    // picture advertises something the customer is not buying.
    const brownie = photoBrief("salted-caramel-brownie")!;
    expect(brownie.mustNotShow).toContain("ice cream");
    const softServe = photoBrief("vanilla-soft-serve")!;
    expect(softServe.mustNotShow).toContain("waffle cone");
  });

  it("keeps mustShow and mustNotShow from contradicting each other", () => {
    for (const entry of PHOTO_BRIEFS) {
      for (const shown of entry.mustShow) {
        expect(entry.mustNotShow, entry.slug).not.toContain(shown);
      }
    }
  });

  it("requires a licence on any credit that is filled in", () => {
    for (const entry of PHOTO_BRIEFS) {
      if (!entry.credit) continue;
      expect(entry.credit.licence.trim().length, entry.slug).toBeGreaterThan(0);
      expect(entry.credit.source.trim().length, entry.slug).toBeGreaterThan(0);
    }
  });

  it("shows a credit only where the licence demands one", () => {
    for (const entry of PHOTO_BRIEFS) {
      const shown = photoCredit(entry.slug);
      if (entry.credit?.attributionRequired) expect(shown).not.toBeNull();
      else expect(shown).toBeNull();
    }
  });

  it("reports which dishes are still waiting on a photograph", () => {
    const waiting = unsourcedSlugs();
    // Not an assertion that the list is empty — it is the coverage report.
    expect(Array.isArray(waiting)).toBe(true);
    expect(waiting.length).toBeLessThanOrEqual(MENU_ITEMS.length);
  });
});
