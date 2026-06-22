export type PostalAddress = {
  line1?: string
  line2?: string
  city?: string
  state?: string
  zip?: string
  country?: string
}

export type BillFrom = {
  name: string
  legalForm?: string
  address: PostalAddress
  siret?: string
  tvaIntra?: string
  email?: string
  phone?: string
  logoUrl?: string
  iban?: string
  bic?: string
}

export type BillTo = {
  name: string
  type: "company" | "individual"
  address: PostalAddress
  email?: string
  phone?: string
  siret?: string
  tvaIntra?: string
}

export type ClientForBilling = {
  name: string
  type: "company" | "individual"
  email: string | null
  phone: string | null
  billingAddress: unknown
}

export type EmitterInput = {
  name: string
  legalForm?: string
  address: PostalAddress
  siret?: string
  tvaIntra?: string
  email?: string
  phone?: string
  logoUrl?: string
  iban?: string
  bic?: string
}

export function parseAddressJsonb(raw: unknown): PostalAddress {
  if (raw === null || raw === undefined) return {}
  if (typeof raw === "string") return { line1: raw }
  if (typeof raw === "object" && !Array.isArray(raw)) {
    const candidate = raw as Record<string, unknown>
    const result: PostalAddress = {}
    if (typeof candidate.line1 === "string") result.line1 = candidate.line1
    if (typeof candidate.line2 === "string") result.line2 = candidate.line2
    if (typeof candidate.city === "string") result.city = candidate.city
    if (typeof candidate.state === "string") result.state = candidate.state
    if (typeof candidate.zip === "string") result.zip = candidate.zip
    if (typeof candidate.country === "string") result.country = candidate.country
    return result
  }
  return {}
}

export function resolveBillingParty(client: ClientForBilling): BillTo {
  return {
    name: client.name,
    type: client.type,
    address: parseAddressJsonb(client.billingAddress),
    email: client.email ?? undefined,
    phone: client.phone ?? undefined,
  }
}

export function resolveEmitter(input: EmitterInput): BillFrom {
  return {
    name: input.name,
    legalForm: input.legalForm,
    address: input.address,
    siret: input.siret,
    tvaIntra: input.tvaIntra,
    email: input.email,
    phone: input.phone,
    logoUrl: input.logoUrl,
    iban: input.iban,
    bic: input.bic,
  }
}

export function formatPostalAddressOneLine(addr: PostalAddress): string {
  const parts: string[] = []
  if (addr.line1) parts.push(addr.line1)
  if (addr.line2) parts.push(addr.line2)
  const zipCity = [addr.zip, addr.city].filter(Boolean).join(" ")
  if (zipCity) parts.push(zipCity)
  if (addr.country) parts.push(addr.country)
  return parts.join(", ")
}

export function formatPostalAddress(addr: PostalAddress): string[] {
  const lines: string[] = []
  if (addr.line1) lines.push(addr.line1)
  if (addr.line2) lines.push(addr.line2)
  const zipCity = [addr.zip, addr.city].filter(Boolean).join(" ")
  if (zipCity) lines.push(zipCity)
  if (addr.state) lines.push(addr.state)
  if (addr.country) lines.push(addr.country)
  return lines
}
