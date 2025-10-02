export type FundingOpportunity = {
  title: string;
  deadline: string;
  url: string;
};

export function seedFundingRadar(): FundingOpportunity[] {
  return [
    {
      title: "Community Impact Grant",
      deadline: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
      url: "https://example.org/funding/community-impact"
    }
  ];
}
