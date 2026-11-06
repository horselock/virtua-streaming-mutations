import { describe, expect, it } from "vitest";
import {
	ACTION_FOLLOW_END_CHANGE,
	ACTION_FOLLOW_END_THRESHOLD_CHANGE,
	ACTION_ITEM_RESIZE,
	ACTION_BEFORE_MANUAL_SMOOTH_SCROLL,
	ACTION_ITEMS_LENGTH_CHANGE,
	ACTION_MANUAL_SCROLL,
	ACTION_SCROLL,
	ACTION_SCROLL_END,
	ACTION_VIEWPORT_RESIZE,
	createVirtualStore,
} from "./store.js";

describe("createVirtualStore", () => {
	describe("$getRange", () => {
		it("should return valid range when viewport becomes 0 after removing all items", () => {
			const store = createVirtualStore(10, 50);

			// Viewport gets measured
			store.$update(ACTION_VIEWPORT_RESIZE, 500);
			store.$getRange();

			// Remove all items - this can cause internal _prevRange to become [-1, -1]
			store.$update(ACTION_ITEMS_LENGTH_CHANGE, [0, false]);
			store.$getRange();

			// Viewport collapses to 0
			store.$update(ACTION_VIEWPORT_RESIZE, 0);

			// $getRange should return a valid range, not [-1, -1]
			const range = store.$getRange();
			expect(range[0]).toBeGreaterThanOrEqual(0);
		});
	});

	describe("followEnd", () => {
		// Ten 100px items in a 500px viewport, scrolled to the end at 500.
		const atEnd = (followEnd = true) => {
			const store = createVirtualStore(10, 100);
			store.$update(ACTION_FOLLOW_END_CHANGE, followEnd);
			store.$update(ACTION_VIEWPORT_RESIZE, 500);
			store.$update(ACTION_SCROLL, 500);
			return store;
		};
		// The scroller applies the store's jump to scrollTop, which comes back as a scroll event.
		const applyJump = (store: ReturnType<typeof atEnd>) => {
			const [jump] = store._flushJump();
			if (jump) store.$update(ACTION_SCROLL, store.$getScrollOffset() + jump);
			return jump;
		};

		it("keeps the viewport at the end while the last item grows", () => {
			const store = atEnd();
			expect(store.$isFollowingEnd()).toBe(true);
			store.$update(ACTION_ITEM_RESIZE, [[9, 160]]);
			expect(applyJump(store)).toBe(60);
			store.$update(ACTION_ITEM_RESIZE, [[9, 230]]);
			expect(applyJump(store)).toBe(70);
			expect(store.$getScrollOffset()).toBe(630);
			expect(store.$isFollowingEnd()).toBe(true);
		});

		it("follows items added at the end", () => {
			const store = atEnd();
			store.$update(ACTION_ITEMS_LENGTH_CHANGE, [12, false]);
			expect(applyJump(store)).toBe(200);
			expect(store.$isFollowingEnd()).toBe(true);
		});

		it("stops following once the viewport is scrolled up, and resumes at the end", () => {
			const store = atEnd();
			store.$update(ACTION_SCROLL, 497);
			expect(store.$isFollowingEnd()).toBe(false);
			store.$update(ACTION_ITEM_RESIZE, [[9, 160]]);
			expect(applyJump(store)).toBe(0);

			store.$update(ACTION_SCROLL, 560);
			expect(store.$isFollowingEnd()).toBe(true);
		});

		it("follows a scroll down that lands within the threshold of an end that grew under it", () => {
			const store = atEnd();
			store.$update(ACTION_FOLLOW_END_THRESHOLD_CHANGE, 32);
			store.$update(ACTION_SCROLL, 300);
			store.$update(ACTION_ITEM_RESIZE, [[9, 120]]);
			store.$update(ACTION_SCROLL, 500);
			expect(store.$isFollowingEnd()).toBe(true);
		});

		it("does not follow a scroll down that stops further short", () => {
			const store = atEnd();
			store.$update(ACTION_FOLLOW_END_THRESHOLD_CHANGE, 32);
			store.$update(ACTION_SCROLL, 300);
			store.$update(ACTION_SCROLL, 460);
			expect(store.$isFollowingEnd()).toBe(false);
		});

		it("stops following on a small scroll up from the end, whatever the threshold", () => {
			const store = atEnd();
			store.$update(ACTION_FOLLOW_END_THRESHOLD_CHANGE, 32);
			store.$update(ACTION_SCROLL, 490);
			expect(store.$isFollowingEnd()).toBe(false);
		});

		it("treats a scroll up that lands on a just-applied jump as the person's", () => {
			const store = atEnd();
			store.$update(ACTION_ITEM_RESIZE, [[9, 160]]);
			// The jump was flushed, but the person's scroll up arrived instead of its echo.
			store._flushJump();
			store.$update(ACTION_SCROLL, 480);
			expect(store.$isFollowingEnd()).toBe(false);
		});

		it("keeps the end in view when the viewport shrinks", () => {
			const store = atEnd();
			store.$update(ACTION_VIEWPORT_RESIZE, 300);
			expect(applyJump(store)).toBe(200);
		});

		it("follows content that fits the viewport once it grows past it, without a scroll", () => {
			const store = createVirtualStore(2, 100);
			store.$update(ACTION_FOLLOW_END_CHANGE, true);
			store.$update(ACTION_VIEWPORT_RESIZE, 500);
			store.$update(ACTION_ITEM_RESIZE, [[1, 300]]);
			expect(applyJump(store)).toBe(0);
			store.$update(ACTION_ITEM_RESIZE, [[1, 600]]);
			expect(applyJump(store)).toBe(200);
			expect(store.$isFollowingEnd()).toBe(true);
		});

		it("turning on reads where the viewport is now, not where it last scrolled to", () => {
			const store = atEnd(false);
			store.$update(ACTION_ITEM_RESIZE, [[9, 900]]);
			store.$update(ACTION_FOLLOW_END_CHANGE, true);
			expect(store.$isFollowingEnd()).toBe(false);
			store.$update(ACTION_ITEM_RESIZE, [[9, 950]]);
			expect(applyJump(store)).toBe(0);
		});

		it("stops following on a scroll up that lands in the same event as a follow jump", () => {
			const store = atEnd();
			store.$update(ACTION_ITEM_RESIZE, [[9, 160]]);
			store._flushJump();
			// The 60px jump and the person's 20px up arrive as one scroll of 40px.
			store.$update(ACTION_SCROLL, 540);
			expect(store.$isFollowingEnd()).toBe(false);
		});

		it("turning following off and on again while a jump waits for its scroll keeps following", () => {
			const store = atEnd();
			store.$update(ACTION_ITEM_RESIZE, [[9, 160]]);
			store._flushJump();
			store.$update(ACTION_FOLLOW_END_CHANGE, false);
			store.$update(ACTION_FOLLOW_END_CHANGE, true);
			expect(store.$isFollowingEnd()).toBe(true);
		});

		it("knows the end moved away while not following", () => {
			const store = atEnd(false);
			expect(store.$isAtEnd()).toBe(true);
			store.$update(ACTION_ITEM_RESIZE, [[9, 160]]);
			expect(store.$isAtEnd()).toBe(false);
		});

		it("drops a held-back follow jump once the viewport leaves the end", () => {
			const store = atEnd();
			// A smooth scroll holds jumps back until it ends, as iOS does during any scroll.
			store.$update(ACTION_MANUAL_SCROLL);
			store.$update(ACTION_BEFORE_MANUAL_SMOOTH_SCROLL, 300);
			store.$update(ACTION_ITEM_RESIZE, [[9, 160]]);
			store.$update(ACTION_SCROLL, 300);
			store.$update(ACTION_SCROLL_END);
			expect(store._flushJump()[0]).toBe(0);
		});

		it("keeps the correction for a row above the viewport when a held-back follow jump is dropped", () => {
			const store = atEnd();
			store.$update(ACTION_MANUAL_SCROLL);
			store.$update(ACTION_BEFORE_MANUAL_SMOOTH_SCROLL, 300);
			// Row 0 sits wholly above the viewport (at 500); its growth is a correction, not following.
			store.$update(ACTION_ITEM_RESIZE, [[0, 150], [9, 160]]);
			store.$update(ACTION_SCROLL, 300);
			store.$update(ACTION_SCROLL_END);
			expect(store._flushJump()[0]).toBe(50);
		});

		it("credits two follow jumps landing in one scroll event to the list, not the person", () => {
			const store = atEnd();
			store.$update(ACTION_FOLLOW_END_THRESHOLD_CHANGE, 32);
			store.$update(ACTION_ITEM_RESIZE, [[9, 160]]);
			store._flushJump();
			store.$update(ACTION_ITEM_RESIZE, [[9, 230]]);
			store._flushJump();
			// Both jumps (60 + 70) and the person's 20px up arrive as one scroll of 110px.
			store.$update(ACTION_SCROLL, 610);
			expect(store.$isFollowingEnd()).toBe(false);
		});

		it("does nothing unless enabled", () => {
			const store = atEnd(false);
			expect(store.$isFollowingEnd()).toBe(false);
			store.$update(ACTION_ITEM_RESIZE, [[9, 160]]);
			expect(applyJump(store)).toBe(0);
		});
	});
});
