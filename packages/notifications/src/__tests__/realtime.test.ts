import { describe, expect, it, vi } from "vitest";

import { publish, subscribe } from "../realtime";

describe("realtime notifications", () => {
  it("notifies every subscriber for a user", () => {
    const userId = "user-123";
    const notification = {
      id: "notif-1",
      userId,
      title: "Test notification",
      body: "This is only a test"
    };

    const firstListener = vi.fn();
    const secondListener = vi.fn();

    const unsubscribeFirst = subscribe(userId, firstListener);
    const unsubscribeSecond = subscribe(userId, secondListener);

    publish(notification);

    expect(firstListener).toHaveBeenCalledWith(notification);
    expect(secondListener).toHaveBeenCalledWith(notification);

    unsubscribeFirst();
    unsubscribeSecond();
  });
});
