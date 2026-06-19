import React from "react"
import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer"
import type { BillFrom, BillTo } from "@saas/services/billing-party.shared"
import { formatPostalAddress } from "@saas/services/billing-party.shared"

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
    padding: 40,
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
    borderBottomColor: "#e0e0e0",
    paddingVertical: 4,
  },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 2,
    borderBottomColor: "#333333",
    paddingVertical: 4,
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
    alignItems: "flex-end",
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
    paddingVertical: 2,
    fontFamily: "Helvetica-Bold",
    borderTopWidth: 1,
    borderTopColor: "#333333",
    marginTop: 2,
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
