import { NextResponse } from "next/server";
import type Stripe from "stripe";
import {
  createStripeSubscription,
  ensureStripeCustomer,
  StripeConfigurationError
} from "@airnub/utils/billing";
import {
  getSupabaseClient,
  SupabaseConfigurationError
} from "../../../../server/supabase";

interface ProvisionPayload {
  tenantOrgId: string;
  priceId: string;
  customerEmail: string;
  customerName?: string;
  billingMode?: "direct" | "partner_managed";
  partnerOrgId?: string | null;
  metadata?: Record<string, string>;
}

function toIso(timestamp: number | null | undefined): string | null {
  if (!timestamp) {
    return null;
  }
  return new Date(timestamp * 1000).toISOString();
}

function isValidUuid(value: string | null | undefined): boolean {
  if (!value) {
    return false;
  }
  return /^[0-9a-fA-F-]{36}$/.test(value.trim());
}

export async function POST(request: Request) {
  let payload: ProvisionPayload;

  try {
    payload = (await request.json()) as ProvisionPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload" }, { status: 400 });
  }

  if (!payload.tenantOrgId || !payload.priceId || !payload.customerEmail) {
    return NextResponse.json(
      { ok: false, error: "tenantOrgId, priceId, and customerEmail are required" },
      { status: 400 }
    );
  }

  try {
    const supabase = getSupabaseClient();

    const membershipCheck = await supabase.rpc("assert_tenant_membership", {
      target_tenant: payload.tenantOrgId
    });

    if (membershipCheck.error) {
      return NextResponse.json({ ok: false, error: membershipCheck.error.message }, { status: 403 });
    }

    const { data: existingTenant, error: tenantLookupError } = await supabase
      .from("billing_tenants")
      .select("id, stripe_customer_id, billing_mode")
      .eq("tenant_org_id", payload.tenantOrgId)
      .maybeSingle();

    if (tenantLookupError) {
      return NextResponse.json({ ok: false, error: tenantLookupError.message }, { status: 400 });
    }

    const customer = await ensureStripeCustomer({
      stripeCustomerId: existingTenant?.stripe_customer_id ?? null,
      email: payload.customerEmail,
      name: payload.customerName ?? null,
      tenantOrgId: payload.tenantOrgId,
      billingMode: payload.billingMode ?? existingTenant?.billing_mode ?? "direct",
      partnerOrgId: isValidUuid(payload.partnerOrgId ?? null) ? payload.partnerOrgId ?? null : null,
      defaultPriceId: payload.priceId,
      metadata: payload.metadata
    });

    const tenantResult = await supabase.rpc("rpc_upsert_billing_tenant", {
      p_tenant_org_id: payload.tenantOrgId,
      p_stripe_customer_id: customer.id,
      p_billing_mode: payload.billingMode ?? existingTenant?.billing_mode ?? "direct",
      p_partner_org_id: isValidUuid(payload.partnerOrgId ?? null) ? payload.partnerOrgId ?? null : null,
      p_default_price_id: payload.priceId,
      p_metadata: {
        ...(payload.metadata ?? {}),
        tenant_org_id: payload.tenantOrgId,
        price_id: payload.priceId
      }
    });

    if (tenantResult.error) {
      return NextResponse.json({ ok: false, error: tenantResult.error.message }, { status: 400 });
    }

    const subscription = await createStripeSubscription({
      customerId: customer.id,
      priceId: payload.priceId,
      metadata: {
        ...(payload.metadata ?? {}),
        tenant_org_id: payload.tenantOrgId
      }
    });

    const price = subscription.items.data[0]?.price ?? null;

    if (price) {
      const priceResult = await supabase.rpc("rpc_upsert_billing_price", {
        p_stripe_price_id: price.id,
        p_product_name:
          typeof price.product === "string"
            ? price.product
            : price.product && "name" in price.product
              ? (price.product as Stripe.Product).name
              : price.nickname ?? "Stripe price",
        p_nickname: price.nickname ?? null,
        p_unit_amount: typeof price.unit_amount === "number" ? price.unit_amount : null,
        p_currency: price.currency ?? "usd",
        p_interval: price.recurring?.interval ?? null,
        p_interval_count: price.recurring?.interval_count ?? null,
        p_is_active: price.active,
        p_metadata: price.metadata ?? {}
      });

      if (priceResult.error) {
        return NextResponse.json({ ok: false, error: priceResult.error.message }, { status: 400 });
      }
    }

    const subscriptionResult = await supabase.rpc("rpc_upsert_billing_subscription", {
      p_tenant_org_id: payload.tenantOrgId,
      p_billing_tenant_id: (tenantResult.data as { id?: string } | null)?.id ?? existingTenant?.id ?? null,
      p_stripe_subscription_id: subscription.id,
      p_status: subscription.status,
      p_stripe_price_id: price?.id ?? payload.priceId,
      p_current_period_start: toIso(subscription.current_period_start),
      p_current_period_end: toIso(subscription.current_period_end),
      p_cancel_at: toIso(subscription.cancel_at),
      p_canceled_at: toIso(subscription.canceled_at),
      p_cancel_at_period_end: subscription.cancel_at_period_end ?? false,
      p_collection_method: subscription.collection_method ?? null,
      p_latest_invoice_id:
        typeof subscription.latest_invoice === "string"
          ? subscription.latest_invoice
          : subscription.latest_invoice?.id ?? null,
      p_metadata: subscription.metadata ?? {}
    });

    if (subscriptionResult.error) {
      return NextResponse.json({ ok: false, error: subscriptionResult.error.message }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      customerId: customer.id,
      subscriptionId: subscription.id,
      status: subscription.status
    });
  } catch (error) {
    if (error instanceof SupabaseConfigurationError || error instanceof StripeConfigurationError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 503 });
    }
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
