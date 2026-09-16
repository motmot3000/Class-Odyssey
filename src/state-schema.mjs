/** Minimal persisted shape shared by the browser and API.
 * Optional legacy fields are migrated by domain.normalizeState(). Reject broken
 * rows and duplicate identities here instead of saving a state the UI cannot use.
 */
export const isRecord = value => value !== null && typeof value === "object" && !Array.isArray(value);

/* Bounds keep a hostile or buggy client from persisting an unbounded state.
 * They are generous compared to real classroom data. */
const MAX_CLASSES = 50;
const MAX_PUPILS_PER_CLASS = 300;
const MAX_NAME_LENGTH = 80;
const MAX_ID_LENGTH = 64;
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f]/;

const isShortText = (value, max = MAX_NAME_LENGTH) =>
  typeof value === "string" && value.length <= max && !CONTROL_CHARS.test(value);

export function isStateDocument(value) {
  if (!isRecord(value) || !Array.isArray(value.classes) || !value.classes.length) return false;
  if (value.classes.length > MAX_CLASSES) return false;
  const classIds = new Set();
  const pupilIds = new Set();
  const remember = (set, id) => {
    if (id === undefined || id === null || id === "") return true;
    if (!["string", "number"].includes(typeof id)) return false;
    const key = String(id);
    if (key.length > MAX_ID_LENGTH) return false;
    if (set.has(key)) return false;
    set.add(key);
    return true;
  };
  return value.classes.every(classroom => isRecord(classroom)
    && remember(classIds, classroom.id)
    && isShortText(classroom.name ?? "")
    && Array.isArray(classroom.pupils)
    && classroom.pupils.length <= MAX_PUPILS_PER_CLASS
    && classroom.pupils.every(pupil => isRecord(pupil)
      && remember(pupilIds, pupil.id)
      && isShortText(pupil.name ?? "")));
}
