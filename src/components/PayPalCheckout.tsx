"use client";

import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";

export default function PayPalCheckout({ total }: { total: number }) {
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID!;

  return (
    <PayPalScriptProvider options={{ clientId, currency: "BRL", intent: "capture" }}>
      <PayPalButtons
        createOrder={async () => {
          const res = await fetch("/api/paypal/create-order", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ total, currency: "BRL" }),
          });
          const data = await res.json();
          return data.id; // PayPal espera el order id :contentReference[oaicite:7]{index=7}
        }}
        onApprove={async (data) => {
          await fetch("/api/paypal/capture-order", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderID: data.orderID }),
          });

          // Aquí: mostrar “Pago exitoso”, habilitar descarga, etc.
        }}
      />
    </PayPalScriptProvider>
  );
}
