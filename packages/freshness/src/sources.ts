type SourceMetadata = {
  url: string;
  label: string;
  jurisdiction?: string;
  category?: string;
};

export const SOURCES: Record<string, SourceMetadata> = {
  cro_open_services: {
    url: "https://api.cro.ie/",
    label: "CRO Open Services",
    jurisdiction: "ie",
    category: "companies"
  },
  charities_ckan: {
    url: "https://data.gov.ie/",
    label: "Charities Regulator CKAN",
    jurisdiction: "ie",
    category: "charities"
  },
  revenue_charities: {
    url: "https://www.revenue.ie/",
    label: "Revenue Charities",
    jurisdiction: "ie",
    category: "charities"
  },
  funding_radar: {
    url: "https://data.gov.ie/",
    label: "Funding Radar",
    jurisdiction: "ie",
    category: "funding"
  }
};

export type { SourceMetadata };
