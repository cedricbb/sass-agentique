import React from "react"
import { Document, Page, View, Text, Image, StyleSheet, Svg, Polygon } from "@react-pdf/renderer"
import type { BillFrom, BillTo } from "@saas/services/billing-party.shared"
import { formatPostalAddress, formatPostalAddressOneLine } from "@saas/services/billing-party.shared"
import { formatCurrency } from "../format"

export const PDF_DARK = "#2A2A2A"
export const PDF_ON_DARK = "#FFFFFF"
export const PDF_ACCENT = "#D4941A"
export const PDF_ON_ACCENT = "#000000"
export const PDF_ACCENT_SOFT = "#FDF3E1"

export type PdfLineItem = {
  description: string
  quantity: number
  unitPriceHtCents: number
  totalHtCents: number
}


const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    paddingBottom: 40,
  },
  partyBlockContainer: {
    marginBottom: 8,
  },
  partyLabel: {
    fontSize: 8,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  partyName: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginBottom: 2,
  },
  partyLine: {
    fontSize: 10,
    lineHeight: 1.4,
  },
  tableContainer: {
    marginTop: 16,
    marginBottom: 16,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#ECECEC",
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: PDF_ACCENT_SOFT,
    borderRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: 6,
    fontFamily: "Helvetica-Bold",
  },
  colDescription: {
    flex: 3,
  },
  colQty: {
    flex: 1,
    textAlign: "right",
  },
  colUnitPrice: {
    flex: 2,
    textAlign: "right",
  },
  colTotal: {
    flex: 2,
    textAlign: "right",
  },
  totalsContainer: {
    marginTop: 8,
    alignSelf: "flex-end",
    width: 220,
    borderWidth: 1,
    borderColor: "#CCCCCC",
    borderRadius: 6,
    padding: 8,
  },
  totalsRow: {
    flexDirection: "row",
    width: 200,
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  totalsTtcRow: {
    flexDirection: "row",
    width: 200,
    justifyContent: "space-between",
    paddingVertical: 4,
    paddingHorizontal: 6,
    fontFamily: "Helvetica-Bold",
    backgroundColor: PDF_ACCENT_SOFT,
    color: PDF_ON_ACCENT,
    borderRadius: 3,
  },
  logo: {
    height: 50,
    width: 120,
    objectFit: "contain",
    marginBottom: 6,
  },
})

const sharedStyles = StyleSheet.create({
  contentPadding: { paddingHorizontal: 40 },
})

export const contentPadding = sharedStyles.contentPadding

const headerStyles = StyleSheet.create({
  banner: {
    position: "relative",
    height: 95,
    marginBottom: 8,
  },
  svgWrapper: {
    position: "absolute",
    top: 0,
    left: 0,
  },
  leftZone: {
    position: "absolute",
    top: 0,
    left: 0,
    height: 95,
    width: 210,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingLeft: 16,
  },
  logo: {
    height: 38,
    maxWidth: 120,
    objectFit: "contain",
  },
  emitterName: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    color: PDF_ON_DARK,
    maxWidth: 160,
  },
  rightZone: {
    position: "absolute",
    top: 0,
    right: 0,
    height: 95,
    width: 300,
    justifyContent: "center",
    alignItems: "flex-end",
    paddingRight: 20,
  },
  docType: {
    fontFamily: "Helvetica-Bold",
    fontSize: 22,
    color: PDF_ON_ACCENT,
  },
})

export function PdfHeader(props: {
  docType: "FACTURE" | "DEVIS"
  logoUrl?: string
  emitterName: string
  accent?: string
}): React.ReactElement {
  const accentColor = props.accent ?? PDF_ACCENT
  return (
    <View style={headerStyles.banner}>
      <View style={headerStyles.svgWrapper}>
        <Svg viewBox="0 0 595.28 95" width={595.28} height={95}>
          <Polygon points="0,0 249,0 226,95 0,95" fill={PDF_DARK} />
          <Polygon points="249,0 595.28,0 595.28,95 226,95" fill={accentColor} />
        </Svg>
      </View>
      <View style={headerStyles.leftZone}>
        {props.logoUrl ? (
          // eslint-disable-next-line jsx-a11y/alt-text
          <Image src={props.logoUrl} style={headerStyles.logo} />
        ) : null}
        <Text style={headerStyles.emitterName}>{props.emitterName}</Text>
      </View>
      <View style={headerStyles.rightZone}>
        <Text style={headerStyles.docType}>{props.docType}</Text>
      </View>
    </View>
  )
}

export function PageFrame(props: { children: React.ReactNode }): React.ReactElement {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {props.children}
      </Page>
    </Document>
  )
}

export function PartyBlock(props: { label: string; party: BillFrom | BillTo }): React.ReactElement {
  const { label, party } = props
  const addressLines = formatPostalAddress(party.address)
  return (
    <View style={styles.partyBlockContainer}>
      <Text style={styles.partyLabel}>{label}</Text>
      {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt prop */}
      {"logoUrl" in party && party.logoUrl ? <Image src={party.logoUrl} style={styles.logo} /> : null}
      <Text style={styles.partyName}>{party.name}</Text>
      {addressLines.map((line, i) => (
        <Text key={i} style={styles.partyLine}>{line}</Text>
      ))}
      {party.email ? <Text style={styles.partyLine}>{party.email}</Text> : null}
      {party.phone ? <Text style={styles.partyLine}>{party.phone}</Text> : null}
      {"siret" in party && party.siret ? (
        <Text style={styles.partyLine}>SIRET : {party.siret}</Text>
      ) : null}
      {"tvaIntra" in party && party.tvaIntra ? (
        <Text style={styles.partyLine}>TVA : {party.tvaIntra}</Text>
      ) : null}
    </View>
  )
}

export function ItemsTable(props: { items: PdfLineItem[] }): React.ReactElement {
  return (
    <View style={styles.tableContainer}>
      <View style={styles.tableHeader}>
        <Text style={styles.colDescription}>Description</Text>
        <Text style={styles.colQty}>Qté</Text>
        <Text style={styles.colUnitPrice}>PU HT</Text>
        <Text style={styles.colTotal}>Total HT</Text>
      </View>
      {props.items.map((item, i) => (
        <View key={i} style={styles.tableRow}>
          <Text style={styles.colDescription}>{item.description}</Text>
          <Text style={styles.colQty}>{item.quantity}</Text>
          <Text style={styles.colUnitPrice}>{formatCurrency(item.unitPriceHtCents / 100)}</Text>
          <Text style={styles.colTotal}>{formatCurrency(item.totalHtCents / 100)}</Text>
        </View>
      ))}
    </View>
  )
}

export function TotalsBlock(props: {
  totalHtCents: number
  vatCents: number
  totalTtcCents: number
}): React.ReactElement {
  return (
    <View style={styles.totalsContainer}>
      <View style={styles.totalsRow}>
        <Text>Total HT</Text>
        <Text>{formatCurrency(props.totalHtCents / 100)}</Text>
      </View>
      <View style={styles.totalsRow}>
        <Text>TVA</Text>
        <Text>{formatCurrency(props.vatCents / 100)}</Text>
      </View>
      <View style={styles.totalsTtcRow}>
        <Text>Total TTC</Text>
        <Text>{formatCurrency(props.totalTtcCents / 100)}</Text>
      </View>
    </View>
  )
}

const footerStyles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 10,
    left: 40,
    right: 40,
  },
  rule: {
    borderTopWidth: 0.5,
    borderTopColor: "#CCCCCC",
    marginBottom: 4,
  },
  line: {
    fontSize: 7,
    color: "#5F5E5A",
    textAlign: "center",
    lineHeight: 1.4,
  },
})

export function PdfFooter(props: {
  billFrom: BillFrom
  dueAt?: Date | null
  issuedAt?: Date | null
}): React.ReactElement {
  const { billFrom, dueAt, issuedAt } = props

  const addressOneLine = formatPostalAddressOneLine(billFrom.address)

  const line1Parts = [billFrom.name]
  if (addressOneLine) line1Parts.push(addressOneLine)
  if (billFrom.email) line1Parts.push(billFrom.email)
  if (billFrom.phone) line1Parts.push(billFrom.phone)
  const line1 = line1Parts.join(" · ")

  const line2Parts: string[] = []
  if (billFrom.siret) line2Parts.push(`SIRET ${billFrom.siret}`)
  if (billFrom.tvaIntra) line2Parts.push(`TVA ${billFrom.tvaIntra}`)
  if (billFrom.legalForm) line2Parts.push(billFrom.legalForm)
  const line2 = line2Parts.length > 0 ? line2Parts.join(" · ") : null

  const line3Parts: string[] = []
  if (billFrom.iban) line3Parts.push(`IBAN ${billFrom.iban}`)
  if (billFrom.bic) line3Parts.push(`BIC ${billFrom.bic}`)

  const paymentDelay =
    dueAt && issuedAt
      ? `Paiement à ${Math.round((dueAt.getTime() - issuedAt.getTime()) / 86_400_000)} jours`
      : "Paiement à réception"

  line3Parts.push(paymentDelay)
  line3Parts.push("Pénalités de retard : 3 fois le taux d'intérêt légal")
  line3Parts.push("Indemnité forfaitaire pour frais de recouvrement : 40 euros")
  line3Parts.push("CGV sur demande")
  const line3 = line3Parts.join(" · ")

  return (
    <View fixed style={footerStyles.container}>
      <View style={footerStyles.rule} />
      <Text style={footerStyles.line}>{line1}</Text>
      {line2 ? <Text style={footerStyles.line}>{line2}</Text> : null}
      <Text style={footerStyles.line}>{line3}</Text>
    </View>
  )
}
