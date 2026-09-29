/* Beta support settings: "buy the developer a coffee".
 * The teacher picks an amount, then a payment method. Each method maps an
 * amount id to a public payment URL (Stripe Payment Link, TWINT, PayPal).
 * A method without URLs still shows its button, marked "coming soon".
 * Payment links are public URLs, not secrets. */

export const SUPPORT = {
  currency: "CHF",
  amounts: [
    { id: "coffee", amount: 2 },
    { id: "breakfast", amount: 5 },
    { id: "lunch", amount: 10 }
  ],
  defaultAmount: "breakfast",
  methods: [
    // Card payments through Stripe Payment Links (one link per amount).
    // TEST-mode links (account "Click and Class"): replace with the live
    // buy.stripe.com links once the Stripe account is activated.
    { id: "card", urls: {
      coffee: "https://buy.stripe.com/test_8x28wO7qm4cG7U0cjQ0RG00",
      breakfast: "https://buy.stripe.com/test_cNiaEW3a67oScagbfM0RG01",
      lunch: "https://buy.stripe.com/test_4gMbJ0eSO5gK4HO97E0RG02"
    } },
    // To configure later.
    { id: "twint", urls: {} },
    { id: "paypal", urls: {} }
  ]
};

export function supportUrl(methodId, amountId) {
  return SUPPORT.methods.find((method) => method.id === methodId)?.urls[amountId] || "";
}

export function methodAvailable(method) {
  return Object.values(method.urls).some(Boolean);
}
