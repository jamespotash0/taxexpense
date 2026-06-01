// Receipt detail + edit. OWNER: Emma + David. EPIC-4, Day 7. Note: Next 16 params is async.
export default async function ReceiptDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-semibold">Receipt</h1>
      <p className="mt-2 text-sm text-gray-500">Detail + edit for {id} — TODO(EPIC-4).</p>
    </main>
  );
}
