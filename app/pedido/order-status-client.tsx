"use client";

import { useEffect, useState } from "react";

type Order = {
  orderCode: number;
  status: string;
  customer?: string;
  total?: number;
  items?: Array<{ name: string; price: number }>;
};

const steps = ["Pendente", "Aceito", "Saiu para entrega", "Finalizado"];
const labels: Record<string, string> = {
  Pendente: "Pedido recebido",
  Aceito: "Em preparo",
  "Saiu para entrega": "Pedido a caminho",
  Finalizado: "Pedido finalizado",
  Recusado: "Pedido não aceito",
};

export default function OrderStatusClient({ token }: { token: string | null }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;

    let stopped = false;
    const load = async () => {
      try {
        const response = await fetch(
          `/api/orders/${encodeURIComponent(token)}`,
          { cache: "no-store" },
        );
        if (!response.ok) throw new Error();
        const data = (await response.json()) as { order: Order };
        if (!stopped) setOrder(data.order);
      } catch {
        if (!stopped) setError("Não foi possível localizar este pedido.");
      }
    };

    void load();
    const timer = setInterval(() => void load(), 4000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [token]);

  const active = order ? steps.indexOf(order.status) : -1;
  const message = error || (!token ? "Código de acompanhamento ausente." : "");

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#fff7e8",
        color: "#3b0710",
        fontFamily: "Arial,sans-serif",
        padding: "32px 18px",
      }}
    >
      <section
        style={{
          maxWidth: 680,
          margin: "0 auto",
          background: "#fffaf0",
          border: "1px solid #dfbd76",
          borderRadius: 22,
          padding: 28,
          boxShadow: "0 18px 50px #3b071018",
        }}
      >
        <p
          style={{
            color: "#a72b1d",
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: 1.5,
          }}
        >
          Macarrão Dellas
        </p>
        {message ? (
          <h1>{message}</h1>
        ) : !order ? (
          <h1>Carregando seu pedido…</h1>
        ) : (
          <>
            <h1 style={{ fontSize: 36, marginBottom: 8 }}>
              {labels[order.status] ?? order.status}
            </h1>
            <p>
              Pedido #{String(order.orderCode).padStart(2, "0")} de{" "}
              {order.customer}. Esta página atualiza automaticamente.
            </p>
            <div style={{ display: "grid", gap: 12, margin: "28px 0" }}>
              {steps.map((step, index) => (
                <div
                  key={step}
                  style={{
                    padding: 16,
                    borderRadius: 14,
                    background: index <= active ? "#65101c" : "#f2e4ca",
                    color: index <= active ? "white" : "#795b49",
                    fontWeight: 700,
                  }}
                >
                  {index < active ? "✓ " : index === active ? "● " : "○ "}
                  {labels[step]}
                </div>
              ))}
            </div>
            {order.status === "Recusado" && (
              <p style={{ color: "#9c2c1e", fontWeight: 700 }}>
                Entre em contato conosco pelo WhatsApp para mais informações.
              </p>
            )}
            <div
              style={{ borderTop: "1px solid #e2c89c", paddingTop: 18 }}
            >
              <strong>
                Total:{" "}
                {Number(order.total ?? 0).toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
              </strong>
              <p style={{ color: "#795b49" }}>
                {order.items?.length ?? 0} item(ns) no pedido
              </p>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
