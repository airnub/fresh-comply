export type ScheduledDigest = {
  userId: string;
  sendAt: string;
  overdueCount: number;
};

export function nextDailyDigest(userId: string, overdueCount: number): ScheduledDigest {
  const now = new Date();
  const sendAt = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 8, 0, 0);
  return { userId, sendAt: sendAt.toISOString(), overdueCount };
}
