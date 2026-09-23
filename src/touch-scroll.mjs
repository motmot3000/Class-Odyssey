/* Drag-to-scroll for touch-first classroom boards.
 *
 * Many interactive whiteboards and IR panels report finger input as a mouse.
 * The browser then never performs native touch scrolling, so the page can only
 * be moved by grabbing the scrollbar — painful on a 75" screen. This module
 * turns a press-and-drag on any quiet area into a pan of the nearest scrollable
 * container (or the page itself). Real touch input keeps its native momentum
 * scrolling and is left untouched.
 *
 * A control can opt out with `data-no-drag`; links, buttons, fields, media and
 * canvases are excluded so clicks, typing and the 3D viewers keep working.
 */

const INTERACTIVE = [
  "a", "button", "input", "select", "textarea", "label", "summary",
  "canvas", "img", "video", "audio",
  "[role='button']", "[role='link']", "[role='slider']", "[role='tab']",
  "[contenteditable='true']", "[data-no-drag]"
].join(",");

const DRAG_THRESHOLD = 6;

export function enableDragScroll(doc = globalThis.document, win = globalThis.window) {
  if (!doc || !win) return () => {};

  let drag = null;
  let suppressClick = false;

  const scrollingElement = () => doc.scrollingElement || doc.documentElement;

  const isScrollable = (node) => {
    const style = win.getComputedStyle(node);
    const vertical = /(auto|scroll|overlay)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 1;
    const horizontal = /(auto|scroll|overlay)/.test(style.overflowX) && node.scrollWidth > node.clientWidth + 1;
    return { vertical, horizontal };
  };

  /* Nearest ancestor that can actually scroll, else the document itself.
     The root element reports `overflow: visible`, so it is measured directly
     instead of going through the overflow test. */
  const scrollerFor = (target) => {
    for (let node = target instanceof win.Element ? target : null; node; node = node.parentElement) {
      if (node === doc.body || node === doc.documentElement) break;
      const { vertical, horizontal } = isScrollable(node);
      if (vertical || horizontal) return { node, vertical, horizontal };
    }
    const node = scrollingElement();
    return { node, vertical: node.scrollHeight > node.clientHeight + 1, horizontal: node.scrollWidth > node.clientWidth + 1 };
  };

  const onPointerDown = (event) => {
    suppressClick = false;
    if (event.button !== 0 || event.defaultPrevented) return;
    if (event.pointerType === "touch") return;
    const target = event.target;
    if (!(target instanceof win.Element) || target.closest(INTERACTIVE)) return;
    if (win.getSelection && String(win.getSelection())) return;
    drag = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      source: target,
      active: false,
      scroller: null
    };
  };

  const onPointerMove = (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!drag.active) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      drag.active = true;
      drag.scroller = scrollerFor(drag.source);
      doc.documentElement.classList.add("is-panning");
      try { drag.source.setPointerCapture?.(drag.id); } catch { /* capture is optional */ }
    }
    event.preventDefault();
    const { node, vertical, horizontal } = drag.scroller;
    if (vertical) node.scrollTop -= dy;
    if (horizontal) node.scrollLeft -= dx;
    drag.x = event.clientX;
    drag.y = event.clientY;
  };

  const onPointerEnd = (event) => {
    if (!drag || (event && event.pointerId !== drag.id)) return;
    if (drag.active) suppressClick = true;
    try { drag.source.releasePointerCapture?.(drag.id); } catch { /* already released */ }
    drag = null;
    doc.documentElement.classList.remove("is-panning");
  };

  const onClick = (event) => {
    if (!suppressClick) return;
    suppressClick = false;
    event.preventDefault();
    event.stopPropagation();
  };

  doc.addEventListener("pointerdown", onPointerDown, { capture: true });
  doc.addEventListener("pointermove", onPointerMove, { capture: true, passive: false });
  doc.addEventListener("pointerup", onPointerEnd, { capture: true });
  doc.addEventListener("pointercancel", onPointerEnd, { capture: true });
  doc.addEventListener("click", onClick, { capture: true });
  win.addEventListener("blur", onPointerEnd);

  return () => {
    doc.removeEventListener("pointerdown", onPointerDown, { capture: true });
    doc.removeEventListener("pointermove", onPointerMove, { capture: true });
    doc.removeEventListener("pointerup", onPointerEnd, { capture: true });
    doc.removeEventListener("pointercancel", onPointerEnd, { capture: true });
    doc.removeEventListener("click", onClick, { capture: true });
    win.removeEventListener("blur", onPointerEnd);
  };
}
