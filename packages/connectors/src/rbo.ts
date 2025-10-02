export type RBOFilingStep = {
  question: string;
  helperText?: string;
};

export function getRBOChecklist(): RBOFilingStep[] {
  return [
    { question: "Do you have the PPSN or VIF for each beneficial owner?" },
    { question: "Has the company incorporated within the last 5 months?", helperText: "Filing deadline is 5 months post-incorporation." },
    { question: "Have you prepared the RBO form for CRO submission?" }
  ];
}
