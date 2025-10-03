type Notification = {
  id: string;
  userId: string;
  title: string;
  body: string;
  readAt?: string;
};

type Listener = (notification: Notification) => void;

const listeners = new Map<string, Set<Listener>>();

export function subscribe(userId: string, callback: Listener) {
  let callbacks = listeners.get(userId);
  if (!callbacks) {
    callbacks = new Set();
    listeners.set(userId, callbacks);
  }

  callbacks.add(callback);

  return () => {
    const currentCallbacks = listeners.get(userId);
    currentCallbacks?.delete(callback);

    if (currentCallbacks && currentCallbacks.size === 0) {
      listeners.delete(userId);
    }
  };
}

export function publish(notification: Notification) {
  const callbacks = listeners.get(notification.userId);
  if (!callbacks?.size) return;

  const snapshot = Array.from(callbacks);
  for (const callback of snapshot) {
    callback(notification);
  }
}
