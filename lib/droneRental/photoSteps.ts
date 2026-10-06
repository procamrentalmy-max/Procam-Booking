export type DronePhotoStep = { key: string; label: string; instruction: string };

/**
 * The guided photos taken at handover and again at return, one per page: a label and an instruction for exactly what to
 * photograph. Two photos, the same two for both drones and the same two both times, so the handover and the return can be
 * compared side by side if there's ever a dispute. After them comes the checklist page.
 *
 * The Neo 2's controller is the RC-N3 (controllerType); the GT50's has no model name, so it is just "the controller".
 */
export function dronePhotoSteps(model: { controllerType: string | null }): DronePhotoStep[] {
  const controller = model.controllerType ? `${model.controllerType} controller` : "controller";
  return [
    {
      key: "drone_and_controller",
      label: "Drone and controller, both on",
      instruction: `Turn the drone and the ${controller} ON. Photograph the drone from above with the controller next to it, both with their lights on.`,
    },
    {
      key: "front",
      label: "Front and camera",
      instruction: "Photograph the front of the drone, close up on the camera and gimbal.",
    },
  ];
}
