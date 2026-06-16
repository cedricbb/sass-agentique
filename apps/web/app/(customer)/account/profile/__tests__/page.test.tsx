import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, it, expect, vi, beforeEach } from "vitest"

const mockGetUserTotpStatus = vi.hoisted(() => vi.fn())

vi.mock("@saas/services", () => ({
  getUserTotpStatus: (...args: unknown[]) => mockGetUserTotpStatus(...args),
}))
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: Record<string, unknown>) =>
    React.createElement("a", { href: href as string, ...rest }, children as React.ReactNode),
}))
vi.mock("lucide-react", () => ({
  ShieldCheck: () => null,
  Lock: () => null,
  KeyRound: () => null,
}))
vi.mock("@/components/profile/CustomerChangePasswordButton", () => ({
  CustomerChangePasswordButton: () =>
    React.createElement("button", { "data-testid": "change-password-btn" }, "Changer le mot de passe"),
}))
vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children, variant }: Record<string, unknown>) =>
    React.createElement("span", { "data-variant": variant as string }, children as React.ReactNode),
}))

describe("CustomerSecuritySection", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders_security_section_with_totp_disabled", async () => {
    mockGetUserTotpStatus.mockResolvedValue({ totpEnabled: false })

    const { CustomerSecuritySection } = await import(
      "@/components/profile/CustomerSecuritySection"
    )
    const element = await CustomerSecuritySection({ userId: "user-1" })
    const html = renderToStaticMarkup(element)

    expect(html).toContain("Sécurité")
    expect(html).toContain("Configurer le 2FA")
    expect(html).toContain("Changer le mot de passe")
  })

  it("renders_security_section_with_totp_enabled", async () => {
    mockGetUserTotpStatus.mockResolvedValue({ totpEnabled: true })

    const { CustomerSecuritySection } = await import(
      "@/components/profile/CustomerSecuritySection"
    )
    const element = await CustomerSecuritySection({ userId: "user-1" })
    const html = renderToStaticMarkup(element)

    expect(html).toContain("Désactiver le 2FA")
    expect(html).toContain("Activé")
  })

  it("security_2fa_button_links_to_setup_when_disabled", async () => {
    mockGetUserTotpStatus.mockResolvedValue({ totpEnabled: false })

    const { CustomerSecuritySection } = await import(
      "@/components/profile/CustomerSecuritySection"
    )
    const element = await CustomerSecuritySection({ userId: "user-1" })
    const html = renderToStaticMarkup(element)

    expect(html).toContain('href="/account/security/setup"')
  })

  it("security_2fa_button_links_to_security_when_enabled", async () => {
    mockGetUserTotpStatus.mockResolvedValue({ totpEnabled: true })

    const { CustomerSecuritySection } = await import(
      "@/components/profile/CustomerSecuritySection"
    )
    const element = await CustomerSecuritySection({ userId: "user-1" })
    const html = renderToStaticMarkup(element)

    expect(html).toContain('href="/account/security"')
  })
})
