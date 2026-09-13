import { describe, expect, it } from "vitest";
import { quotePhotoPrint } from "./pricing";

describe("quotePhotoPrint", () => {
  it("prices guest 4R orders at retail", () => {
    expect(quotePhotoPrint("4R", 7, false)).toEqual({ billedTo: "GUEST", unitPriceMyr: 0.93, totalPriceMyr: 6.5 });
    expect(quotePhotoPrint("4R", 10, false)).toEqual({ billedTo: "GUEST", unitPriceMyr: 0.9, totalPriceMyr: 9 });
  });

  it("still bills to the guest even at a complimentary partner, since no 4R wholesale rate exists", () => {
    expect(quotePhotoPrint("4R", 7, true)).toEqual({ billedTo: "GUEST", unitPriceMyr: 0.93, totalPriceMyr: 6.5 });
    expect(quotePhotoPrint("4R", 10, true)).toEqual({ billedTo: "GUEST", unitPriceMyr: 0.9, totalPriceMyr: 9 });
  });

  it("throws for a quantity that isn't offered", () => {
    // @ts-expect-error 5 was only ever valid for the now-discontinued 3R
    expect(() => quotePhotoPrint("4R", 5, false)).toThrow(/isn't an offered print count/);
  });
});
