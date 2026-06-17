import React from "react"
import { inflateSync } from "zlib"
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer"

export function decodePdfHexStrings(content: string): string {
  const hexPattern = /<([0-9a-fA-F]{2,})>/g
  const parts: string[] = []
  let match: RegExpExecArray | null
  while ((match = hexPattern.exec(content)) !== null) {
    const hex = match[1]
    let decoded = ""
    for (let i = 0; i + 1 < hex.length; i += 2) {
      const code = parseInt(hex.slice(i, i + 2), 16)
      if (code >= 0x20 && code <= 0x7e) {
        decoded += String.fromCharCode(code)
      }
    }
    if (decoded) parts.push(decoded)
  }
  return parts.join("")
}

export function decompressPdfStreams(pdfBuffer: Buffer): string {
  const pdfLatin = pdfBuffer.toString("latin1")
  const decompressedParts: string[] = []
  const streamPattern = /stream\r?\n([\s\S]*?)\r?\nendstream/g
  let match: RegExpExecArray | null
  while ((match = streamPattern.exec(pdfLatin)) !== null) {
    try {
      const compressed = Buffer.from(match[1], "latin1")
      const decompressed = inflateSync(compressed)
      decompressedParts.push(decompressed.toString("latin1"))
    } catch {
    }
  }
  return decompressedParts.join("\n")
}

export function normalize(s: string): string {
  return s.replace(/\s+/g, "")
}

export async function extractPdfText(element: React.ReactElement): Promise<string> {
  const buffer = await renderToBuffer(element as React.ReactElement<DocumentProps>)
  const decompressed = decompressPdfStreams(buffer)
  return decodePdfHexStrings(decompressed)
}

export function containsNormalized(haystack: string, needle: string): boolean {
  return normalize(haystack).includes(normalize(needle))
}
