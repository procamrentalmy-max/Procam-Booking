import { DEFAULT_CONTROLLER, controllerProfileFor, type ControllerKind } from "./pricingRules";

export type DronePhotoStep = { key: string; label: string; instruction: string };

/**
 * The guided photos taken at handover and again at return, one per page: a label and an instruction for exactly what to
 * photograph. Two photos, the same two for every drone and the same two both times, so the handover and the return can be
 * compared side by side if there's ever a dispute. After them comes the checklist page. The first photo shows the drone
 * with whatever controller goes out (the RC-N3, or the goggles set), or the drone alone for a phone-only rental.
 *
 * The first photo's key stays the same whichever it is, so photos are filed the same way.
 */
export function dronePhotoSteps(model: string | null | undefined, controller: ControllerKind = DEFAULT_CONTROLLER): DronePhotoStep[] {
  const profile = controllerProfileFor(model, controller);
  return [
    controller === "NONE" || !profile
      ? {
          key: "drone_and_controller",
          label: "Drone, on",
          instruction: "Turn the drone ON. Photograph the drone from above with its lights on.",
        }
      : profile.key === "GOGGLES_N3"
        ? {
            key: "drone_and_controller",
            label: "Drone and goggles set, all on",
            instruction:
              "Turn the drone, the Goggles N3 and the Motion 3 controller ON. Photograph the drone from above with the goggles and the Motion 3 controller next to it, all with their lights on.",
          }
        : {
            key: "drone_and_controller",
            label: "Drone and controller, both on",
            instruction: `Turn the drone and the ${profile.name.toLowerCase().startsWith("rc") ? profile.name : profile.name.toLowerCase()} ON. Photograph the drone from above with the controller next to it, both with their lights on.`,
          },
    {
      key: "front",
      label: "Front and camera",
      instruction: "Photograph the front of the drone, close up on the camera and gimbal.",
    },
  ];
}
