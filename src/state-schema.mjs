/** Minimal persisted shape shared by the browser and API.
 * Optional legacy fields are migrated by domain.normalizeState(). Reject broken
 * rows and duplicate identities here instead of saving a state the UI cannot use.
 */
export const isRecord = value => value !== null && typeof value === "object" && !Array.isArray(value);

export function isStateDocument(value) {
  if (!isRecord(value) || !Array.isArray(value.classes) || !value.classes.length) return false;
  const classIds = new Set();
  const pupilIds = new Set();
  const remember = (set, id) => {
    if (id === undefined || id === null || id === "") return true;
    if (!["string", "number"].includes(typeof id)) return false;
    const key = String(id);
    if (set.has(key)) return false;
    set.add(key);
    return true;
  };
  return value.classes.every(classroom => isRecord(classroom)
    && remember(classIds, classroom.id)
    && Array.isArray(classroom.pupils)
    && classroom.pupils.every(pupil => isRecord(pupil) && remember(pupilIds, pupil.id)));
}
