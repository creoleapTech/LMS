/**
 * LeapLab integration helpers.
 *
 * LeapLab lives at https://leaplab.creoleap.com and auto-detects the project
 * mode (junior/intermediate) when a project URL is passed via the `project`
 * query parameter. The LMS uses these helpers to render "Open in LeapLab"
 * actions for `.leap` files instead of a generic download button.
 */

export const LEAPLAB_BASE_URL = "https://leaplab.creoleap.com";

export type LeapMode = "junior" | "intermediate";

/**
 * Build a LeapLab URL that opens the given project file.
 */
export function getLeapLabUrl(projectUrl: string): string {
  return `${LEAPLAB_BASE_URL}?project=${encodeURIComponent(projectUrl)}`;
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
    return null;
  } catch {
    return null;
  }
}
