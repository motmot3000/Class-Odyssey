/** Synchronization policy shared by the browser app and its tests.
 *
 * Two machines editing the same classroom must never fight over a revision.
 * The rule this module encodes: only classroom content is shared, and a device
 * that holds nothing new must adopt the server copy instead of reporting a
 * conflict. Which class is open and which hero is focused belong to the
 * device, so they never travel to the server and never bump a revision.
 */

/* View state: per device, never persisted server-side. */
export const VIEW_FIELDS = ["activeClassId", "selectedPupilId", "selectedPupilIds", "selectMode"];

/* Bookkeeping the server owns; comparing it would report a false difference. */
const SERVER_FIELDS = ["revision", "updatedAt"];

const omit = (source, fields) => {
  const payload = { ...source };
  for (const field of fields) delete payload[field];
  return payload;
};

/** The part of a state document the server stores and shares. */
export function sharedState(source) {
  return omit(source, VIEW_FIELDS);
}

/** The part that must be equal for two devices to agree on classroom data. */
export function classroomData(source) {
  return omit(source, [...VIEW_FIELDS, ...SERVER_FIELDS]);
}

/** True when both states carry the same classroom content. */
export function sameClassroomData(left, right) {
  return JSON.stringify(classroomData(left)) === JSON.stringify(classroomData(right));
}

/**
 * Decide what a device does when the server copy arrives.
 *
 * - `adopt`   — take the server copy; nothing local is pending.
 * - `push`    — the device holds real changes at the server's revision; send them.
 * - `conflict`— both sides changed since the last sync; ask the teacher.
 *
 * A dirty flag alone is not a conflict: if the payload matches what the server
 * already holds, the flag is stale and the device simply adopts the server copy.
 */
export function decideBootstrap({ local, remote, localDirty }) {
  const localRevision = Number(local?.revision) || 0;
  const remoteRevision = Number(remote?.revision) || 0;
  if (remoteRevision < localRevision) return "adopt";
  /* Nothing differs: adopt, whatever the dirty flag or the revision says. A
   * stale flag on a device that holds no real change must never block it. */
  if (sameClassroomData(local, remote)) return "adopt";
  if (!localDirty) return "adopt";
  if (localRevision === remoteRevision) return "push";
  return "conflict";
}

/**
 * Keep this device's view state when the server copy arrives, as long as the
 * class and hero it points at still exist there.
 */
export function adoptRemoteState(remote, previous) {
  const next = { ...remote };
  if (previous && Array.isArray(previous.classes) && Array.isArray(next.classes)) {
    if (previous.activeClassId && next.classes.some((item) => item.id === previous.activeClassId)) {
      next.activeClassId = previous.activeClassId;
    }
    const pupils = next.classes.flatMap((item) => item.pupils || []);
    if (previous.selectedPupilId && pupils.some((pupil) => pupil.id === previous.selectedPupilId)) {
      next.selectedPupilId = previous.selectedPupilId;
    }
  }
  return next;
}
