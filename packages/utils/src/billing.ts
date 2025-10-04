import Stripe from "stripe";

export class StripeConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StripeConfigurationError";
  }
}

export class StripeWebhookVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StripeWebhookVerificationError";
  }
}

let stripeClient: Stripe | null = null;

function resolveStripeSecretKey(): string {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    throw new StripeConfigurationError(
      "STRIPE_SECRET_KEY must be configured to perform billing operations."
    );
  }
  return secret;
}

function resolveWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new StripeConfigurationError(
      "STRIPE_WEBHOOK_SECRET must be configured to verify incoming Stripe events."
    );
  }
  return secret;
}

export function getStripeClient(): Stripe {
  if (!stripeClient) {
    const secretKey = resolveStripeSecretKey();
    stripeClient = new Stripe(secretKey, {
      apiVersion: "2024-06-20"
    });
  }
  return stripeClient;
}

export function verifyStripeWebhookSignature(payload: string, signature: string | null): Stripe.Event {
  if (!signature) {
    throw new StripeWebhookVerificationError("Missing Stripe-Signature header");
  }
  const webhookSecret = resolveWebhookSecret();
  try {
    return Stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error) {
    throw new StripeWebhookVerificationError(
      `Invalid Stripe signature: ${(error as Error).message}`
    );
  }
}

export interface EnsureStripeCustomerParams {
  stripeCustomerId?: string | null;
  email?: string | null;
  name?: string | null;
  tenantOrgId?: string;
  billingMode?: string | null;
  partnerOrgId?: string | null;
  defaultPriceId?: string | null;
  metadata?: Stripe.MetadataParam;
}

export async function ensureStripeCustomer({
  stripeCustomerId,
  email,
  name,
  tenantOrgId,
  billingMode,
  partnerOrgId,
  defaultPriceId,
  metadata
}: EnsureStripeCustomerParams): Promise<Stripe.Customer> {
  const stripe = getStripeClient();
  const mergedMetadata: Stripe.MetadataParam = {
    ...(metadata ?? {}),
    ...(tenantOrgId ? { org_id: tenantOrgId } : {}),
    ...(billingMode ? { billing_mode: billingMode } : {}),
    ...(partnerOrgId ? { partner_org_id: partnerOrgId } : {}),
    ...(defaultPriceId ? { default_price_id: defaultPriceId } : {})
  };

  if (stripeCustomerId) {
    return stripe.customers.update(stripeCustomerId, {
      email: email ?? undefined,
      name: name ?? undefined,
      metadata: mergedMetadata
    });
  }

  return stripe.customers.create({
    email: email ?? undefined,
    name: name ?? undefined,
    metadata: mergedMetadata
  });
}

export interface CreateStripeSubscriptionParams {
  customerId: string;
  priceId: string;
  trialPeriodDays?: number;
  collectionMethod?: "charge_automatically" | "send_invoice";
  metadata?: Stripe.MetadataParam;
}

export async function createStripeSubscription({
  customerId,
  priceId,
  trialPeriodDays,
  collectionMethod,
  metadata
}: CreateStripeSubscriptionParams): Promise<Stripe.Subscription> {
  const stripe = getStripeClient();
  return stripe.subscriptions.create({
    customer: customerId,
    items: [
      {
        price: priceId
      }
    ],
    trial_period_days: trialPeriodDays,
    collection_method: collectionMethod,
    metadata
  });
}
