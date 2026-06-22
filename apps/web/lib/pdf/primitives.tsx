import React from "react"
import { Document, Page, View, Text, Image, StyleSheet, Svg, Polygon } from "@react-pdf/renderer"
import type { BillFrom, BillTo } from "@saas/services/billing-party.shared"
import { formatPostalAddress } from "@saas/services/billing-party.shared"

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

function centsToEur(cents: number): string {
  return (cents / 100).toFixed(2) + " €"
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
  legalFooter: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 7,
    color: "#888888",
    textAlign: "center",
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
          <Text style={styles.colUnitPrice}>{centsToEur(item.unitPriceHtCents)}</Text>
          <Text style={styles.colTotal}>{centsToEur(item.totalHtCents)}</Text>
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
        <Text>{centsToEur(props.totalHtCents)}</Text>
      </View>
      <View style={styles.totalsRow}>
        <Text>TVA</Text>
        <Text>{centsToEur(props.vatCents)}</Text>
      </View>
      <View style={styles.totalsTtcRow}>
        <Text>Total TTC</Text>
        <Text>{centsToEur(props.totalTtcCents)}</Text>
      </View>
    </View>
  )
}

export function LegalFooter(props: { text?: string }): React.ReactElement {
  const content = props.text ?? "Mentions légales — à compléter (R10-1f)"
  return <Text style={styles.legalFooter}>{content}</Text>
}
