export function PricingFaq({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className="space-y-4">
      {items.map((item, i) => (
        <details key={i} className="group border rounded-lg p-4">
          <summary className="font-medium cursor-pointer">{item.q}</summary>
          <p className="mt-2 text-sm text-muted-foreground">{item.a}</p>
        </details>
      ))}
    </div>
  );
}
