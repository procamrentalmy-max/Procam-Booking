export type PhotoPhase = "pickup" | "return";

export type DronePhotoStep = { key: string; label: string; instruction: string };

/**
 * The guided photos taken at handover and again at return, one per page (the same pattern as the Insta360
 * pre-rental check): a label and an instruction for exactly what to photograph. The same set is used both
 * times so the two can be compared side by side if there's ever a dispute. Only the battery wording depends
 * on how many batteries this rental has and which end of the rental it is.
 */
export function dronePhotoSteps(batteries: number, phase: PhotoPhase): DronePhotoStep[] {
  const one = batteries === 1;
  const noun = one ? "battery" : "batteries";
  const direction = phase === "pickup" ? "being handed over" : "being returned";

  return [
    {
      key: "power_on",
      label: "Power on",
      instruction: "Turn the drone and the RC-N3 controller ON, then photograph both together with their lights on.",
    },
    {
      key: "front",
      label: "Front and camera",
      instruction: "Photograph the front of the drone, close up on the camera and gimbal.",
    },
    {
      key: "top",
      label: "Top and propellers",
      instruction: "Photograph the drone from above so all 4 propellers and guards are in the picture.",
    },
    {
      key: "underside",
      label: "Underside",
      instruction: "Turn the drone over and photograph the underside, including the sensors and the battery slot.",
    },
    {
      key: "controller",
      label: "RC-N3 controller",
      instruction: "Photograph the front of the controller, showing the sticks and buttons.",
    },
    {
      key: "batteries",
      label: one ? "Battery" : "Batteries",
      instruction: one ? `Photograph the battery ${direction}.` : `Photograph the ${batteries} ${noun} ${direction}, side by side with the labels facing up.`,
    },
    {
      key: "kit_full",
      label: "Everything together",
      instruction: `Lay out the drone, the controller and the ${one ? "battery" : `${batteries} ${noun}`} together and photograph it all in one picture.`,
    },
  ];
}
