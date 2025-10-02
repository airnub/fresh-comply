export async function lookupCompanyByName(name: string) {
  // TODO: call CRO Open Services when available; return mock for now
  return [{ name, number: "000000", status: "AVAILABLE_OR_MOCK" }];
}
