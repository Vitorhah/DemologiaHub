import test from "node:test";
import assert from "node:assert/strict";
import { A4_HEIGHT_PX, A4_WIDTH_PX } from "./masterCreations";
import {
  computeDragSmartGuides,
  computeResizeSmartGuides,
  type CreationGuideReference,
} from "./creationSmartGuides";

test("computeDragSmartGuides gently assists aligning element center to A4 page center", () => {
  // Page center X is 397; a 200px-wide box centered at 397 has x = 297.
  // Passing x = 300 is 3px off (within 5px gentle assist radius).
  const res = computeDragSmartGuides(
    { x: 300, y: 120, width: 200, height: 80 },
    [],
  );

  assert.equal(res.box.x, 297);
  assert.equal(res.box.y, 120);
  const pageCenterGuide = res.guides.find(
    (g) => g.orientation === "vertical" && g.kind === "page-center",
  );
  assert.ok(pageCenterGuide, "should emit vertical page-center guide");
  assert.equal(pageCenterGuide.position, A4_WIDTH_PX / 2);
  assert.equal(pageCenterGuide.start, 0);
  assert.equal(pageCenterGuide.end, A4_HEIGHT_PX);
});

test("computeDragSmartGuides never traps movement outside the gentle assist radius", () => {
  // 10px away from center (297 + 10 = 307) — must remain completely untouched
  const res = computeDragSmartGuides(
    { x: 307, y: 140, width: 200, height: 80 },
    [],
  );

  assert.equal(res.box.x, 307);
  assert.equal(res.box.y, 140);
  assert.equal(res.guides.length, 0);
  assert.equal(res.spacingGuides.length, 0);
});

test("computeDragSmartGuides respects enabled=false and Alt assistSnap=false", () => {
  const disabled = computeDragSmartGuides(
    { x: 299, y: 120, width: 200, height: 80 },
    [],
    { enabled: false },
  );
  assert.equal(disabled.box.x, 299);
  assert.equal(disabled.guides.length, 0);

  const freehand = computeDragSmartGuides(
    { x: 299, y: 120, width: 200, height: 80 },
    [],
    { enabled: true, assistSnap: false },
  );
  assert.equal(freehand.box.x, 299);
});

test("computeDragSmartGuides synchronizes edges and centers with sibling elements", () => {
  const siblings: CreationGuideReference[] = [
    { id: "a", x: 100, y: 80, width: 160, height: 60 },
  ];

  // Dragging near sibling's left edge (x=103 -> snaps to 100) and bottom edge (y=138 -> snaps to 140)
  const res = computeDragSmartGuides(
    { x: 103, y: 138, width: 120, height: 50 },
    siblings,
  );

  assert.equal(res.box.x, 100);
  assert.equal(res.box.y, 140);
  assert.ok(
    res.guides.some(
      (g) =>
        g.orientation === "vertical" &&
        g.position === 100 &&
        g.kind === "element-edge",
    ),
  );
  assert.ok(
    res.guides.some(
      (g) =>
        g.orientation === "horizontal" &&
        g.position === 140 &&
        g.kind === "element-edge",
    ),
  );
});

test("computeDragSmartGuides detects equal horizontal spacing between two siblings", () => {
  const siblings: CreationGuideReference[] = [
    { id: "left", x: 60, y: 200, width: 100, height: 80 }, // right = 160
    { id: "right", x: 360, y: 200, width: 100, height: 80 }, // left = 360
  ];
  // Available gap = 360 - 160 = 200. For a 100px box, centered x = 210 (gaps 50 & 50).
  const res = computeDragSmartGuides(
    { x: 213, y: 200, width: 100, height: 80 },
    siblings,
  );

  assert.equal(res.box.x, 210);
  assert.equal(res.spacingGuides.length, 2);
  assert.equal(res.spacingGuides[0].orientation, "horizontal");
  assert.equal(res.spacingGuides[0].distance, 50);
  assert.equal(res.spacingGuides[1].distance, 50);
});

test("computeResizeSmartGuides aligns dragged edge without distorting locked aspect ratio", () => {
  const siblings: CreationGuideReference[] = [
    { id: "ref", x: 140, y: 100, width: 320, height: 60 }, // right = 460 (distinct from A4 center 397)
  ];

  // Free resize east edge near 460 -> assists to exact width 320 (right = 460)
  const freeRes = computeResizeSmartGuides(
    { x: 140, y: 200, width: 317, height: 70 },
    "e",
    siblings,
    { lockAspectRatio: false },
  );
  assert.equal(freeRes.box.width, 320);
  assert.ok(
    freeRes.guides.some(
      (g) => g.orientation === "vertical" && g.position === 460,
    ),
  );

  // Locked aspect ratio: box width must NEVER be mutated by snap, still shows visual guide
  const lockedRes = computeResizeSmartGuides(
    { x: 140, y: 200, width: 319, height: 159 },
    "se",
    siblings,
    { lockAspectRatio: true },
  );
  assert.equal(lockedRes.box.width, 319);
  assert.equal(lockedRes.box.height, 159);
  assert.ok(
    lockedRes.guides.some(
      (g) => g.orientation === "vertical" && g.position === 460,
    ),
  );
});
