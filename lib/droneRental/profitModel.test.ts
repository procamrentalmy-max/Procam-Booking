import { describe, expect, it } from "vitest";
import { averageTicketMyr, cardFeeMyr, dayTypeOf, forecastByDayType, forecastMonthlySales, TARGET_MARGIN, ymdList } from "./profitModel";

describe("profit model", () => {
  it("charges 3% + RM1 per card payment", () => {
    expect(cardFeeMyr(100)).toBeCloseTo(4, 5);
    expect(cardFeeMyr(0)).toBe(0);
  });

  it("tells weekdays, weekends and holidays apart", () => {
    expect(dayTypeOf("2026-10-14")).toBe("WEEKDAY"); // Wednesday
    expect(dayTypeOf("2026-10-17")).toBe("WEEKEND"); // Saturday
    expect(dayTypeOf("2026-08-31")).toBe("HOLIDAY_WEEKDAY"); // Merdeka Monday
    expect(dayTypeOf("2026-12-09")).toBe("HOLIDAY_WEEKDAY"); // year-end school break
    expect(dayTypeOf("2026-12-12")).toBe("HOLIDAY_WEEKEND");
  });

  it("splits the year into days that add up", () => {
    const f = forecastByDayType(2026);
    expect(f.reduce((n, d) => n + d.days, 0)).toBe(ymdList(2026).length);
    const [weekday, holidayWeekday, weekend, holidayWeekend] = f;
    expect(weekday.rentals).toBeLessThan(holidayWeekday.rentals);
    expect(holidayWeekday.rentals).toBeLessThan(weekend.rentals);
    expect(weekend.rentals).toBeLessThan(holidayWeekend.rentals);
  });

  it("plans profit at the target share of sales and scales with the scenario", () => {
    const base = forecastByDayType(2026, "BASE")[0];
    expect(base.profitMyr).toBeCloseTo(base.salesMyr * TARGET_MARGIN, 6);
    expect(forecastByDayType(2026, "HIGH")[0].salesMyr).toBeCloseTo(base.salesMyr * 2, 6);
    expect(averageTicketMyr()).toBeGreaterThan(0);
  });

  it("monthly sales add up to the daily forecast", () => {
    const yearly = forecastByDayType(2026).reduce((n, d) => n + d.days * d.salesMyr, 0);
    expect(forecastMonthlySales(2026).reduce((a, b) => a + b, 0)).toBeCloseTo(yearly, 4);
  });
});
