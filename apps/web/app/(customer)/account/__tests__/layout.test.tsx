import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: Record<string, unknown>) =>
    React.createElement("a", { href: href as string, ...rest }, children as React.ReactNode),
}))
vi.mock("@/components/ui/alert", () => ({
  Alert: ({ children, className }: Record<string, unknown>) =>
    React.createElement("div", { className: className as string }, children as React.ReactNode),
  AlertDescription: ({ children }: Record<string, unknown>) =>
    React.createElement("div", null, children as React.ReactNode),
}))

import { TwoFactorBanner } from "@/components/auth/TwoFactorBanner"

describe("TwoFactorBanner", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders_2fa_banner_when_totp_disabled", () => {
    const element = React.createElement(TwoFactorBanner, { totpEnabled: false })
    const html = renderToStaticMarkup(element)

    expect(html).toContain("Sécurisez votre compte")
    expect(html).toContain('href="/account/security/setup"')
  })

  it("hides_2fa_banner_when_totp_enabled", () => {
    const element = React.createElement(TwoFactorBanner, { totpEnabled: true })
    const html = renderToStaticMarkup(element)

    expect(html).not.toContain("Sécurisez votre compte")
  })

  it("2fa_banner_has_no_dismiss_button", () => {
    const element = React.createElement(TwoFactorBanner, { totpEnabled: false })
    const html = renderToStaticMarkup(element)

    expect(html).not.toContain('aria-label="close"')
    expect(html).not.toContain('aria-label="dismiss"')
    expect(html).not.toContain("data-dismiss")
    expect(html).not.toContain("type=\"button\"")
  })
})
