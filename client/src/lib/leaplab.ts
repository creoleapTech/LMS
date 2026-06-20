/**
 * LeapLab integration helpers.
 *
 * LeapLab lives at https://leaplab.creoleap.com and auto-detects the project
 * mode (junior/intermediate) when a project URL is passed via the `project`
 * query parameter. The LMS uses these helpers to render "Open in LeapLab"
 * actions for `.leap` files instead of a generic download button.
 */

export const LEAPLAB_BASE_URL = "https://leaplab.creoleap.com";

export type LeapMode = "junior" | "intermediate" | "electra";

/**
 * Build a LeapLab URL that opens the given project file.
 *
 * When the mode is known upfront, it is passed as the `mode` query parameter
 * so LeapLab can route immediately without waiting for the project JSON to be
 * fetched (this avoids a flash of the home screen).
 */
export function getLeapLabUrl(projectUrl: string, mode?: LeapMode): string {
  const url = new URL(LEAPLAB_BASE_URL);
  url.searchParams.set("project", projectUrl);
  if (mode) url.searchParams.set("mode", mode);
  return url.toString();
}

/**
 * Check whether a URL or filename represents a LeapLab project file.
 */
export function isLeapFile(urlOrName: string): boolean {
  return urlOrName.toLowerCase().endsWith(".leap");
}

/**
 * Check whether a URL or filename represents a Scratch 3 project file.
 */
export function isSb3File(urlOrName: string): boolean {
  return urlOrName.toLowerCase().endsWith(".sb3");
}

/**
 * Check whether a URL or filename represents a downloadable project file
 * (.leap or .sb3).
 */
export function isProjectFile(urlOrName: string): boolean {
  return isLeapFile(urlOrName) || isSb3File(urlOrName);
}

/**
 * Detect the LeapLab mode from a remote `.leap` project file.
 * Returns `null` if the mode cannot be determined.
 */
export async function detectLeapMode(projectUrl: string): Promise<LeapMode | null> {
  try {
    const resp = await fetch(projectUrl);
    if (!resp.ok) return null;
    const data = await resp.json();
    if (data?.mode === "junior") return "junior";
    if (data?.mode === "intermediate") return "intermediate";
    if (data?.mode === "electra") return "electra";

    // Electra projects saved before the wrapper was introduced are stored as raw
    // circuit payloads without a mode field. They may be flat (nodes/edges/board)
    // or nested under a `circuit` key, so we check both shapes to cover all
    // already-uploaded trainer projects. Only the two supported Electra boards count.
    const ELECTRA_BOARDS = ["arduino-uno", "esp32-c3"] as const;
    const hasElectraBoard = ELECTRA_BOARDS.includes(data?.board);
    const hasElectraCircuit =
      (Array.isArray(data?.nodes) && Array.isArray(data?.edges)) ||
      (Array.isArray(data?.circuit?.nodes) && Array.isArray(data?.circuit?.edges));
    if (hasElectraCircuit && hasElectraBoard) {
      return "electra";
    }

    return null;
  } catch {
    return null;
  }
}
