export type Session = {
  userId: string;
  orgId: string;
  actingForOrgId?: string;
};

export function getDemoSession(): Session {
  return {
    userId: "11111111-1111-1111-1111-111111111111",
    orgId: "00000000-0000-0000-0000-0000000000a1",
    actingForOrgId: "00000000-0000-0000-0000-0000000000b1"
  };
}
