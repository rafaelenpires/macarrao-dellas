import OrderStatusClient from "./order-status-client";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function OrderStatusPage({ searchParams }: PageProps) {
  const { token } = await searchParams;
  const orderToken = Array.isArray(token) ? token[0] ?? null : token ?? null;

  return <OrderStatusClient token={orderToken} />;
}
