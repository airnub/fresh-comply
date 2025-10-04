import { NextResponse } from "next/server";
import type Stripe from "stripe";
import {
  StripeConfigurationError,
  StripeWebhookVerificationError,
  verifyStripeWebhookSignature
} from "@airnub/utils/billing";
import {
  getServiceSupabaseClient,
  SupabaseServiceConfigurationError,
  type ServiceSupabaseClient
} from "@airnub/utils/supabase-service";

function isDeletedCustomer(customer: Stripe.Customer | Stripe.DeletedCustomer): customer is Stripe.DeletedCustomer {
  return (customer as Stripe.DeletedCustomer).deleted === true;
}

function normalizeTenantOrgId(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function toUuid(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const candidate = value.trim();
  return /^[0-9a-fA-F-]{36}$/.test(candidate) ? candidate : null;
}

function coerceBillingMode(value: string | null | undefined): "direct" | "partner_managed" {
  if (!value) {
    return "direct";
  }
  const normalized = value.toLowerCase();
  if (normalized === "partner" || normalized === "partner_managed") {
    return "partner_managed";
  }
  return "direct";
}

async function upsertStripePrice(price: Stripe.Price, supabase: ServiceSupabaseClient) {
  const recurring = price.recurring ?? undefined;
  const productName =
    typeof price.product === "string"
      ? price.product
      : price.product && "name" in price.product
        ? (price.product as Stripe.Product).name
        : price.nickname ?? "Stripe price";

  const { error } = await supabase.rpc("rpc_upsert_billing_price", {
    p_stripe_price_id: price.id,
    p_product_name: productName,
    p_nickname: price.nickname ?? null,
    p_unit_amount: typeof price.unit_amount === "number" ? price.unit_amount : null,
    p_currency: price.currency ?? "usd",
    p_interval: recurring?.interval ?? null,
    p_interval_count: recurring?.interval_count ?? null,
    p_is_active: price.active,
    p_metadata: price.metadata ?? {}
  });

  if (error) {
    throw new Error(`Failed to upsert billing price: ${error.message}`);
  }
}

async function resolveTenantContext(
  supabase: ServiceSupabaseClient,
  params: {
    tenantOrgId?: string | null;
    customerId?: string | null;
  }
): Promise<{ tenantOrgId: string; billingTenantId: string | null } | null> {
  if (params.tenantOrgId) {
    const { data, error } = await supabase
      .from("billing_tenants")
      .select("id, org_id")
      .eq("org_id", params.tenantOrgId)
      .maybeSingle();

    if (error) {
      throw new Error(`Unable to resolve billing tenant: ${error.message}`);
    }

    if (data?.org_id) {
      return { tenantOrgId: data.org_id, billingTenantId: data.id ?? null };
    }

    return { tenantOrgId: params.tenantOrgId, billingTenantId: null };
  }

  if (params.customerId) {
    const { data, error } = await supabase
      .from("billing_tenants")
      .select("id, org_id")
      .eq("stripe_customer_id", params.customerId)
      .maybeSingle();

    if (error) {
      throw new Error(`Unable to resolve billing tenant by customer id: ${error.message}`);
    }

    if (data?.org_id) {
      return { tenantOrgId: data.org_id, billingTenantId: data.id ?? null };
    }
  }

  return null;
}

async function upsertStripeCustomer(customer: Stripe.Customer, supabase: ServiceSupabaseClient) {
  const metadata = customer.metadata ?? {};
  const tenantOrgId = normalizeTenantOrgId(metadata.org_id ?? metadata.tenantOrgId);

  if (!tenantOrgId) {
    return;
  }

  const { error } = await supabase.rpc("rpc_upsert_billing_tenant", {
    p_org_id: tenantOrgId,
    p_stripe_customer_id: customer.id,
    p_billing_mode: coerceBillingMode(metadata.billing_mode ?? metadata.billingMode),
    p_partner_org_id: toUuid(metadata.partner_org_id ?? metadata.partnerOrgId),
    p_default_price_id: metadata.default_price_id ?? metadata.defaultPriceId ?? null,
    p_metadata: metadata
  });

  if (error) {
    throw new Error(`Failed to upsert billing tenant: ${error.message}`);
  }
}

function toIso(timestamp: number | null | undefined): string | null {
  if (!timestamp) {
    return null;
  }
  return new Date(timestamp * 1000).toISOString();
}

async function upsertStripeSubscription(
  subscription: Stripe.Subscription,
  supabase: ServiceSupabaseClient
) {
  const metadata = subscription.metadata ?? {};
  const explicitTenantOrgId = normalizeTenantOrgId(metadata.org_id ?? metadata.tenantOrgId);
  const context = await resolveTenantContext(supabase, {
    tenantOrgId: explicitTenantOrgId,
    customerId: typeof subscription.customer === "string" ? subscription.customer : null
  });

  if (!context) {
    return;
  }

  const primaryPrice = subscription.items.data[0]?.price;
  if (primaryPrice) {
    await upsertStripePrice(primaryPrice, supabase);
  }

  const latestInvoiceId = (() => {
    if (!subscription.latest_invoice) {
      return null;
    }
    return typeof subscription.latest_invoice === "string"
      ? subscription.latest_invoice
      : subscription.latest_invoice.id;
  })();

  const { error } = await supabase.rpc("rpc_upsert_billing_subscription", {
    p_org_id: context.tenantOrgId,
    p_billing_tenant_id: context.billingTenantId,
    p_stripe_subscription_id: subscription.id,
    p_status: subscription.status,
    p_stripe_price_id: primaryPrice?.id ?? null,
    p_current_period_start: toIso(subscription.current_period_start),
    p_current_period_end: toIso(subscription.current_period_end),
    p_cancel_at: toIso(subscription.cancel_at),
    p_canceled_at: toIso(subscription.canceled_at),
    p_cancel_at_period_end: subscription.cancel_at_period_end ?? false,
    p_collection_method: subscription.collection_method ?? null,
    p_latest_invoice_id: latestInvoiceId,
    p_metadata: metadata
  });

  if (error) {
    throw new Error(`Failed to upsert billing subscription: ${error.message}`);
  }
}

async function handleStripeEvent(event: Stripe.Event, supabase: ServiceSupabaseClient) {
  switch (event.type) {
    case "price.created":
    case "price.updated":
    case "price.deleted": {
      if (event.data.object && (event.data.object as Stripe.Price).object === "price") {
        const price = event.data.object as Stripe.Price;
        await upsertStripePrice(price, supabase);
      }
      break;
    }
    case "customer.created":
    case "customer.updated": {
      if (!isDeletedCustomer(event.data.object as Stripe.Customer | Stripe.DeletedCustomer)) {
        await upsertStripeCustomer(event.data.object as Stripe.Customer, supabase);
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      await upsertStripeSubscription(event.data.object as Stripe.Subscription, supabase);
      break;
    }
    default:
      break;
  }
}

export async function POST(request: Request) {
  let event: Stripe.Event;
  const rawBody = await request.text();

  try {
    event = verifyStripeWebhookSignature(rawBody, request.headers.get("stripe-signature"));
  } catch (error) {
    if (error instanceof StripeWebhookVerificationError || error instanceof StripeConfigurationError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 500 });
  }

  let supabase: ServiceSupabaseClient;
  try {
    supabase = getServiceSupabaseClient();
  } catch (error) {
    if (error instanceof SupabaseServiceConfigurationError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 503 });
    }
    throw error;
  }

  try {
    await handleStripeEvent(event, supabase);
    return NextResponse.json({ ok: true, received: true });
  } catch (error) {
    console.error("Stripe webhook handling failed", error);
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
