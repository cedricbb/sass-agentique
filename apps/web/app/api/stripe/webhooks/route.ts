import { type NextRequest, NextResponse } from "next/server";
import { handleStripeWebhook } from "@/lib/stripe/webhook-handler";

export async function POST(request: NextRequest): Promise<NextResponse> {
  return handleStripeWebhook(request);
}
