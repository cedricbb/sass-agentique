export default function InvoicesLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 w-32 rounded bg-muted" />
          <div className="h-4 w-48 rounded bg-muted" />
        </div>
        <div className="h-10 w-40 rounded bg-muted" />
      </div>
      <div className="h-96 rounded-lg bg-muted" />
    </div>
  );
}
