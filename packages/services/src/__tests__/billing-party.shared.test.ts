import { describe, it, expect } from "vitest"
import {
  resolveBillingParty,
  resolveEmitter,
  formatPostalAddress,
  formatPostalAddressOneLine,
} from "../billing-party.shared"

describe("resolveBillingParty", () => {
  it("resolves_company_client_with_string_address", () => {
    const client = {
      name: "ACME Corp",
      type: "company" as const,
      email: "acme@example.com",
      phone: "+33600000000",
      billingAddress: "12 rue de la Paix, 75001 Paris",
    }
    const result = resolveBillingParty(client)
    expect(result.type).toBe("company")
    expect(result.name).toBe("ACME Corp")
    expect(result.address.line1).toBe("12 rue de la Paix, 75001 Paris")
    expect(result.siret).toBeUndefined()
    expect(result.tvaIntra).toBeUndefined()
  })

  it("resolves_without_contact_backward_compat", () => {
    const client = {
      name: "ACME Corp",
      type: "company" as const,
      email: null,
      phone: null,
      billingAddress: null,
    }
    const result = resolveBillingParty(client)
    expect(result.siret).toBeUndefined()
    expect(result.tvaIntra).toBeUndefined()
    expect(result.attention).toBeUndefined()
  })

  it("resolves_client_siret_and_tva_intra", () => {
    const client = {
      name: "ACME Corp",
      type: "company" as const,
      email: null,
      phone: null,
      billingAddress: null,
      siret: "12345678901234",
      tvaIntra: "FR12345678901",
    }
    const result = resolveBillingParty(client, null)
    expect(result.siret).toBe("12345678901234")
    expect(result.tvaIntra).toBe("FR12345678901")
  })

  it("resolves_attention_from_contact_param", () => {
    const client = {
      name: "ACME Corp",
      type: "company" as const,
      email: null,
      phone: null,
      billingAddress: null,
    }
    const result = resolveBillingParty(client, { name: "Jean Dupont" })
    expect(result.attention).toBe("Jean Dupont")
  })

  it("resolves_client_with_null_address", () => {
    const client = {
      name: "John Doe",
      type: "individual" as const,
      email: null,
      phone: null,
      billingAddress: null,
    }
    const result = resolveBillingParty(client)
    expect(result.address).toEqual({})
  })

  it("resolves_client_with_structured_jsonb_address", () => {
    const client = {
      name: "Beta SAS",
      type: "company" as const,
      email: null,
      phone: null,
      billingAddress: {
        line1: "5 avenue Montaigne",
        city: "Paris",
        zip: "75008",
        country: "France",
      },
    }
    const result = resolveBillingParty(client)
    expect(result.address.line1).toBe("5 avenue Montaigne")
    expect(result.address.city).toBe("Paris")
    expect(result.address.zip).toBe("75008")
    expect(result.address.country).toBe("France")
  })
})

describe("resolveEmitter", () => {
  it("resolves_emitter_with_all_fields", () => {
    const input = {
      name: "Cédric Dupont",
      legalForm: "Auto-entrepreneur",
      address: { line1: "10 rue du Faubourg", city: "Lyon", zip: "69001", country: "France" },
      siret: "12345678901234",
      tvaIntra: "FR12345678901",
      email: "cedric@example.com",
      phone: "+33600000001",
      logoUrl: "https://cdn.example.com/logo.png",
    }
    const result = resolveEmitter(input)
    expect(result.name).toBe("Cédric Dupont")
    expect(result.legalForm).toBe("Auto-entrepreneur")
    expect(result.address).toEqual(input.address)
    expect(result.siret).toBe("12345678901234")
    expect(result.tvaIntra).toBe("FR12345678901")
    expect(result.email).toBe("cedric@example.com")
    expect(result.phone).toBe("+33600000001")
    expect(result.logoUrl).toBe("https://cdn.example.com/logo.png")
  })

  it("resolves_emitter_maps_iban_and_bic", () => {
    const input = {
      name: "Test SAS",
      address: {},
      iban: "FR7630006000011234567890189",
      bic: "BNPAFRPP",
    }
    const result = resolveEmitter(input)
    expect(result.iban).toBe("FR7630006000011234567890189")
    expect(result.bic).toBe("BNPAFRPP")
  })

  it("resolves_emitter_with_optional_fields_missing", () => {
    const input = {
      name: "Cédric Dupont",
      address: { line1: "10 rue du Faubourg" },
    }
    const result = resolveEmitter(input)
    expect(result.name).toBe("Cédric Dupont")
    expect(result.legalForm).toBeUndefined()
    expect(result.siret).toBeUndefined()
    expect(result.tvaIntra).toBeUndefined()
    expect(result.logoUrl).toBeUndefined()
  })
})

describe("formatPostalAddressOneLine", () => {
  it("format_postal_address_one_line_returns_empty_for_empty_address", () => {
    expect(formatPostalAddressOneLine({})).toBe("")
  })

  it("format_postal_address_one_line_formats_complete_address", () => {
    const addr = { line1: "12 rue X", zip: "75001", city: "Paris", country: "France" }
    expect(formatPostalAddressOneLine(addr)).toBe("12 rue X, 75001 Paris, France")
  })
})

describe("formatPostalAddress", () => {
  it("formats_complete_address_in_order", () => {
    const addr = {
      line1: "10 rue du Faubourg",
      line2: "Appt 3",
      city: "Lyon",
      zip: "69001",
      state: "Auvergne-Rhône-Alpes",
      country: "France",
    }
    const lines = formatPostalAddress(addr)
    expect(lines).toEqual([
      "10 rue du Faubourg",
      "Appt 3",
      "69001 Lyon",
      "Auvergne-Rhône-Alpes",
      "France",
    ])
  })

  it("formats_empty_address_to_empty_array", () => {
    expect(formatPostalAddress({})).toEqual([])
  })
})
