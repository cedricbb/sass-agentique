import { describe, expect, it } from "vitest";
import { paymentMethodLabel } from "../payment-labels";

describe("paymentMethodLabel", () => {
  it("returns 'Carte Stripe' for stripe_card", () => {
    expect(paymentMethodLabel("stripe_card")).toBe("Carte Stripe");
  });

  it("returns 'Virement' for bank_transfer", () => {
    expect(paymentMethodLabel("bank_transfer")).toBe("Virement");
  });

  it("returns 'Autre' for other", () => {
    expect(paymentMethodLabel("other")).toBe("Autre");
  });

  it("returns raw value for unknown method", () => {
    expect(paymentMethodLabel("bitcoin")).toBe("bitcoin");
  });
});
