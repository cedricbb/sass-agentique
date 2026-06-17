import "server-only"

import React from "react"
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer"
import type { InvoicePdfModel } from "@saas/services/invoice-pdf.shared"
import { InvoicePdf } from "./InvoicePdf"

export async function renderToPdfBuffer(element: React.ReactElement): Promise<Buffer> {
  const buffer = await renderToBuffer(element as React.ReactElement<DocumentProps>)
  return Buffer.from(buffer)
}

export async function renderInvoicePdf(model: InvoicePdfModel): Promise<Buffer> {
  return renderToPdfBuffer(React.createElement(InvoicePdf, { model }))
}
