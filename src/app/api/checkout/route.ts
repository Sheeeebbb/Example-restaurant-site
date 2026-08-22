import { NextResponse } from "next/server";
import { placeOrder, type PlaceOrderRequest } from "@/lib/order/place-order";
import { saveOrder } from "@/lib/order/order-repository";

/**
 * The checkout endpoint.
 *
 * This is the seam a real payment integration slots into. Today it calls
 * `placeOrder`, which recomputes every price from the live menu and charges the
 * mock provider. With Stripe, the same handler would create a PaymentIntent for
 * the amount IT calculated and return the client secret — the shape of what
 * crosses the wire does not change.
 *
 * Note what the request body does NOT contain: no prices, and no card details.
 * Prices are recomputed here because a client-sent total cannot be trusted;
 * card details never arrive because, with a real processor, they go straight
 * from the browser to Stripe and never touch this server at all.
 */
export async function POST(request: Request) {
  let body: PlaceOrderRequest;

  try {
    body = (await request.json()) as PlaceOrderRequest;
  } catch {
    return NextResponse.json(
      { ok: false, error: "That request couldn't be read." },
      { status: 400 },
    );
  }

  const result = await placeOrder(body);

  if (!result.ok) {
    // 422: the request was well-formed but the order cannot be accepted —
    // sold out, below the delivery minimum, a slot that has passed.
    return NextResponse.json(result, { status: 422 });
  }

  // Persist server-side so the kitchen can see it. Before this existed an order
  // lived only in the customer's browser tab, where no member of staff could
  // ever have reached it.
  await saveOrder(result.order);

  return NextResponse.json(result, { status: 201 });
}
