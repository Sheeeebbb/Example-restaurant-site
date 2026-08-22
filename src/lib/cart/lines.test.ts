import { describe, expect, it } from "vitest";
import { buildLineId, createCartLine, findUnsatisfiedGroups } from "./lines";
import type { MenuItem, SelectedOption } from "../types";

const sel = (groupId: string, optionId: string, priceDelta = 0): SelectedOption => ({
  groupId,
  groupName: groupId,
  optionId,
  name: optionId,
  priceDelta,
});

const item: MenuItem = {
  id: "itm-pizza",
  slug: "pizza",
  categoryId: "cat-wood",
  name: "Pizza",
  description: "A pizza",
  basePrice: 1500,
  image: { src: "/menu/pizza.jpg", alt: "Pizza" },
  tags: [],
  allergens: [],
  available: true,
  featured: false,
  kitchenMinutes: 12,
  optionGroups: [
    {
      id: "grp-size",
      name: "Size",
      selection: "single",
      required: true,
      minSelections: 1,
      maxSelections: 1,
      options: [
        { id: "opt-s", name: "Small", priceDelta: 0, available: true },
        { id: "opt-l", name: "Large", priceDelta: 600, available: true },
      ],
    },
    {
      id: "grp-extras",
      name: "Extras",
      selection: "multi",
      required: false,
      minSelections: 0,
      maxSelections: 2,
      options: [
        { id: "opt-cheese", name: "Cheese", priceDelta: 450, available: true },
        { id: "opt-chili", name: "Chili", priceDelta: 150, available: true },
        { id: "opt-basil", name: "Basil", priceDelta: 100, available: true },
      ],
    },
  ],
};

describe("buildLineId", () => {
  it("is stable regardless of the order options were picked in", () => {
    const a = buildLineId("itm-pizza", [sel("g1", "o1"), sel("g2", "o2")]);
    const b = buildLineId("itm-pizza", [sel("g2", "o2"), sel("g1", "o1")]);
    expect(a).toBe(b);
  });

  it("separates different configurations of the same item", () => {
    const small = buildLineId("itm-pizza", [sel("grp-size", "opt-s")]);
    const large = buildLineId("itm-pizza", [sel("grp-size", "opt-l")]);
    expect(small).not.toBe(large);
  });

  it("separates lines that differ only by their notes", () => {
    const plain = buildLineId("itm-pizza", []);
    const noted = buildLineId("itm-pizza", [], "no basil please");
    expect(plain).not.toBe(noted);
  });

  it("treats blank and whitespace-only notes as no notes", () => {
    expect(buildLineId("itm-pizza", [], "   ")).toBe(buildLineId("itm-pizza", []));
  });
});

describe("createCartLine", () => {
  it("prices the base plus every selected delta", () => {
    const line = createCartLine(
      item,
      [sel("grp-size", "opt-l", 600), sel("grp-extras", "opt-cheese", 450)],
      1,
    );
    expect(line.unitPrice).toBe(2550);
  });

  it("handles negative deltas, such as a smaller portion", () => {
    const line = createCartLine(item, [sel("grp-portion", "opt-half", -400)], 1);
    expect(line.unitPrice).toBe(1100);
  });

  it("snapshots the name and price at the time of adding", () => {
    const line = createCartLine(item, [], 2);
    expect(line.name).toBe("Pizza");
    expect(line.basePrice).toBe(1500);
    expect(line.quantity).toBe(2);
  });
});

describe("findUnsatisfiedGroups", () => {
  it("flags a required group with nothing selected", () => {
    expect(findUnsatisfiedGroups(item, [])).toContain("grp-size");
  });

  it("passes once the required group is satisfied", () => {
    expect(findUnsatisfiedGroups(item, [sel("grp-size", "opt-s")])).toEqual([]);
  });

  it("flags a multi-select group that exceeds its maximum", () => {
    const tooMany = [
      sel("grp-size", "opt-s"),
      sel("grp-extras", "opt-cheese"),
      sel("grp-extras", "opt-chili"),
      sel("grp-extras", "opt-basil"),
    ];
    expect(findUnsatisfiedGroups(item, tooMany)).toContain("grp-extras");
  });
});
