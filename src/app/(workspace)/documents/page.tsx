import { Suspense } from "react";
import { DocumentList } from "@/components/documents/DocumentList";

export default function DocumentsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-zinc-500">Loading…</div>}>
      <DocumentList mode="owned" />
    </Suspense>
  );
}
