import { describe, expect, it } from "vitest";
import { quotePhotoPrint } from "./pricing";

describe("quotePhotoPrint", () => {
  it("prices guest 3R orders at retail", () => {
    expect(quotePhotoPrint("3R", 5, false)).toEqual({ billedTo: "GUEST", unitPriceMyr: 0.8, totalPriceMyr: 4 });
    expect(quotePhotoPrint("3R", 10, false)).toEqual({ billedTo: "GUEST", unitPriceMyr: 0.7, totalPriceMyr: 7 });
  });

  it("prices guest 4R orders at retail", () => {
    expect(quotePhotoPrint("4R", 7, false)).toEqual({ billedTo: "GUEST", unitPriceMyr: 0.93, totalPriceMyr: 6.5 });
    expect(quotePhotoPrint("4R", 10, false)).toEqual({ billedTo: "GUEST", unitPriceMyr: 0.9, totalPriceMyr: 9 });
  });

  it("bills 3R to the hotel when the partner offers complimentary printing", () => {
    expect(quotePhotoPrint("3R", 5, true)).toEqual({ billedTo: "HOTEL", unitPriceMyr: 0.6, totalPriceMyr: 3 });
    expect(quotePhotoPrint("3R", 10, true)).toEqual({ billedTo: "HOTEL", unitPriceMyr: 0.55, totalPriceMyr: 5.5 });
  });

  it("still bills 4R to the guest even at a complimentary partner, since no 4R wholesale rate exists", () => {
    expect(quotePhotoPrint("4R", 7, true)).toEqual({ billedTo: "GUEST", unitPriceMyr: 0.93, totalPriceMyr: 6.5 });
    expect(quotePhotoPrint("4R", 10, true)).toEqual({ billedTo: "GUEST", unitPriceMyr: 0.9, totalPriceMyr: 9 });
  });

  it("throws for a quantity that isn't offered for the given size", () => {
    expect(() => quotePhotoPrint("3R", 7, false)).toThrow(/isn't an offered print count/);
    expect(() => quotePhotoPrint("4R", 5, false)).toThrow(/isn't an offered print count/);
  });
});
