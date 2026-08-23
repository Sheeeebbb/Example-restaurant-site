import { describe, expect, it } from "vitest";
import { applyAutofill, type AutofillField } from "./address-autofill";
import {
  getAddressLookupProvider,
  isAddressLookupConfigured,
} from "./address-lookup";

const touched = (...fields: AutofillField[]) => new Set<AutofillField>(fields);
const draft = (street = "", city = "") => ({ street, city });

/**
 * Autofill's only interesting rule is what it refuses to do. A service that
 * overwrites an address someone has typed is worse than no service at all, so
 * that is what these cover.
 */
describe("applyAutofill", () => {
  it("fills empty, untouched fields", () => {
    expect(applyAutofill(draft(), { street: "Rijselstraat", city: "Menen" }, touched()))
      .toEqual({ street: "Rijselstraat", city: "Menen" });
  });

  it("never overwrites a field the customer has typed in", () => {
    expect(
      applyAutofill(draft("My Street", "My Town"), { street: "Rijselstraat", city: "Menen" }, touched()),
    ).toEqual({});
  });

  it("never overwrites a field the customer has touched, even if they emptied it", () => {
    // They deleted the suggestion on purpose. Putting it back is an argument.
    expect(
      applyAutofill(draft("", ""), { city: "Menen" }, touched("city")),
    ).toEqual({});
  });

  it("fills the fields it can and leaves the rest alone", () => {
    expect(
      applyAutofill(draft("", "My Town"), { street: "Rijselstraat", city: "Menen" }, touched("city")),
    ).toEqual({ street: "Rijselstraat" });
  });

  it("treats whitespace as filled-in, not as empty", () => {
    expect(applyAutofill(draft("  ", ""), { street: "Rijselstraat" }, touched())).toEqual({
      street: "Rijselstraat",
    });
  });

  it("does nothing when the service knows nothing", () => {
    expect(applyAutofill(draft(), null, touched())).toEqual({});
    expect(applyAutofill(draft(), {}, touched())).toEqual({});
  });

  it("ignores fields a service returns empty", () => {
    expect(applyAutofill(draft(), { street: "", city: "Menen" }, touched())).toEqual({
      city: "Menen",
    });
  });
});

describe("getAddressLookupProvider", () => {
  it("reports honestly that no lookup service is connected", () => {
    // This is the assertion to change when a real provider is wired in — until
    // then, nothing in the application may assume autofill exists.
    expect(getAddressLookupProvider()).toBeNull();
    expect(isAddressLookupConfigured()).toBe(false);
  });
});
