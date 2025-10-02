type Notification = {
  id: string;
  userId: string;
  title: string;
  body: string;
  readAt?: string;
};

const listeners = new Map<string, (notification: Notification) => void>();

export function subscribe(userId: string, callback: (notification: Notification) => void) {
  listeners.set(userId, callback);
}

export function publish(notification: Notification) {
  const callback = listeners.get(notification.userId);
  if (callback) callback(notification);
}
