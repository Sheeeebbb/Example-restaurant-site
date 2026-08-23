import { beforeEach, describe, expect, it } from "vitest";
import { useCartStore } from "./store";
import { MENU_ITEMS } from "../data/menu";
import type { SelectedOption } from "../types";

/**
 * The cart's editing contract.
 *
 * The rule these all circle is that a line either has a real quantity or does
 * not exist. A row showing "0" is not a state the customer can reach, reason
 * about, or check out with, so the store must never produce one — whichever
 * control did the decrementing.
 */

const classic = MENU_ITEMS.find((item) => item.slug === "urban-classic")!;
const fries = MENU_ITEMS.find((item) => item.slug === "skin-on-fries")!;

const medium: SelectedOption[] = [
  { groupId: "grp-cook", groupName: "How would you like it cooked?", optionId: "opt-cook-medium", name: "Medium", priceDelta: 0 },
];
const withCheese: SelectedOption[] = [
  ...medium,
  { groupId: "grp-extras", groupName: "Extras", optionId: "opt-extra-cheese", name: "Extra cheese", priceDelta: 150 },
];

const cart = () => useCartStore.getState();
const lineIds = () => cart().lines.map((line) => line.lineId);

beforeEach(() => {
  useCartStore.setState({ lines: [], promotionCode: undefined });
});

describe("removing the last one", () => {
  it("deletes the line when the quantity is taken to zero", () => {
    cart().addItem(classic, medium, 1);
    cart().setQuantity(lineIds()[0], 0);
    expect(cart().lines).toEqual([]);
  });

  it("deletes the line when decrement is pressed at one", () => {
    cart().addItem(classic, medium, 1);
    cart().decrementLine(lineIds()[0]);
    expect(cart().lines).toEqual([]);
  });

  it("keeps one behind when decrement is pressed at two", () => {
    cart().addItem(classic, medium, 2);
    cart().decrementLine(lineIds()[0]);
    expect(cart().lines).toHaveLength(1);
    expect(cart().lines[0].quantity).toBe(1);
  });

  it("counts down to nothing one press at a time", () => {
    cart().addItem(classic, medium, 3);
    const id = lineIds()[0];
    cart().decrementLine(id);
    expect(cart().lines[0].quantity).toBe(2);
    cart().decrementLine(id);
    expect(cart().lines[0].quantity).toBe(1);
    cart().decrementLine(id);
    expect(cart().lines).toEqual([]);
  });

  it("never leaves a line at zero, however it is asked to", () => {
    for (const quantity of [0, -1, -99]) {
      useCartStore.setState({ lines: [] });
      cart().addItem(classic, medium, 1);
      cart().setQuantity(lineIds()[0], quantity);
      expect(cart().lines, String(quantity)).toEqual([]);
      expect(cart().lines.every((line) => line.quantity > 0)).toBe(true);
    }
  });
});

describe("several products at once", () => {
  it("removes only the line that was asked for", () => {
    cart().addItem(classic, medium, 1);
    cart().addItem(fries, [], 2);
    const [classicId] = lineIds();

    cart().setQuantity(classicId, 0);

    expect(cart().lines).toHaveLength(1);
    expect(cart().lines[0].slug).toBe("skin-on-fries");
    expect(cart().lines[0].quantity).toBe(2);
  });

  it("treats a customised version as its own line", () => {
    cart().addItem(classic, medium, 1);
    cart().addItem(classic, withCheese, 1);
    expect(cart().lines).toHaveLength(2);

    // Removing the plain one leaves the customised one, and its price with it.
    cart().decrementLine(lineIds()[0]);
    expect(cart().lines).toHaveLength(1);
    expect(cart().lines[0].unitPrice).toBe(classic.basePrice + 150);
  });

  it("merges an identical configuration instead of duplicating it", () => {
    cart().addItem(classic, medium, 1);
    cart().addItem(classic, medium, 1);
    expect(cart().lines).toHaveLength(1);
    expect(cart().lines[0].quantity).toBe(2);
  });
});

describe("emptying the cart", () => {
  it("leaves nothing behind when the last line goes", () => {
    cart().addItem(classic, medium, 1);
    cart().addItem(fries, [], 1);
    for (const id of lineIds()) cart().setQuantity(id, 0);

    expect(cart().lines).toEqual([]);
  });

  it("drops the promotion code with the lines when the cart is cleared", () => {
    cart().addItem(classic, medium, 1);
    cart().setPromotionCode("WELCOME20");
    cart().clearCart();

    expect(cart().lines).toEqual([]);
    expect(cart().promotionCode).toBeUndefined();
  });
});
