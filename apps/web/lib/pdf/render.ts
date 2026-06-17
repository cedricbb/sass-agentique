import "server-only"

import React from "react"
import { renderToBuffer } from "@react-pdf/renderer"

export async function renderToPdfBuffer(element: React.ReactElement): Promise<Buffer> {
  const buffer = await renderToBuffer(element)
  return Buffer.from(buffer)
}
