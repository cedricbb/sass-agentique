import { describe, it, expect, vi } from "vitest"
import React from "react"

vi.mock("server-only", () => ({}))

import { renderToPdfBuffer } from "../render"
import { PageFrame } from "../primitives"
import { Text } from "@react-pdf/renderer"

describe("renderToPdfBuffer", () => {
  it("render_to_pdf_buffer_produces_valid_pdf", async () => {
    const element = React.createElement(
      PageFrame,
      null,
      React.createElement(Text, null, "hello"),
    )
    const buffer = await renderToPdfBuffer(element)
    expect(Buffer.isBuffer(buffer)).toBe(true)
    const header = buffer.slice(0, 5).toString("ascii")
    expect(header).toBe("%PDF-")
  })
})
