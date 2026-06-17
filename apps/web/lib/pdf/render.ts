import "server-only"

import React from "react"
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer"

export async function renderToPdfBuffer(element: React.ReactElement): Promise<Buffer> {
  const buffer = await renderToBuffer(element as React.ReactElement<DocumentProps>)
  return Buffer.from(buffer)
}
