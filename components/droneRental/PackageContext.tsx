"use client";

import { createContext, useContext, useState } from "react";
import type { BatteryCount, ControllerKind, DroneModel } from "@/lib/droneRental/pricingRules";

type PackageState = {
  model: DroneModel | null;
  controller: ControllerKind | null;
  batteries: BatteryCount | null;
  hours: number | null;
  setModel: (m: DroneModel) => void;
  setController: (c: ControllerKind) => void;
  setBatteries: (n: BatteryCount) => void;
  setHours: (h: number) => void;
};

const PackageContext = createContext<PackageState | null>(null);

/**
 * What the visitor has chosen so far on the landing page, shared by "Check the price" and the choices under the two comparison tables,
 * so picking a favourite under a table fills in the package above. Nothing is chosen to begin with.
 */
export function PackageProvider({ children }: { children: React.ReactNode }) {
  const [model, setModel] = useState<DroneModel | null>(null);
  const [controller, setController] = useState<ControllerKind | null>(null);
  const [batteries, setBatteries] = useState<BatteryCount | null>(null);
  const [hours, setHours] = useState<number | null>(null);
  return <PackageContext.Provider value={{ model, controller, batteries, hours, setModel, setController, setBatteries, setHours }}>{children}</PackageContext.Provider>;
}

export function usePackage(): PackageState {
  const ctx = useContext(PackageContext);
  if (!ctx) throw new Error("usePackage needs a PackageProvider around it");
  return ctx;
}
