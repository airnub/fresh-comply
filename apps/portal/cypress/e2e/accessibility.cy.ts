/// <reference types="cypress" />
import "cypress-axe";

describe("Accessibility smoke tests", () => {
  beforeEach(() => {
    cy.task("log", "running axe checks");
  });

  it("checks English home page", () => {
    cy.visit("/en-IE");
    cy.injectAxe();
    cy.checkA11y(undefined, { includedImpacts: ["critical", "serious"] });
  });

  it("checks Irish home page", () => {
    cy.visit("/ga-IE");
    cy.injectAxe();
    cy.checkA11y(undefined, { includedImpacts: ["critical", "serious"] });
  });
});
