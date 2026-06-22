import React from "react"
import { View, Text, StyleSheet } from "@react-pdf/renderer"
import type { InvoicePdfModel } from "@saas/services/invoice-pdf.shared"
import { formatPostalAddress } from "@saas/services/billing-party.shared"
import {
  PageFrame,
  ItemsTable,
  TotalsBlock,
  LegalFooter,
  PdfHeader,
  contentPadding,
  PDF_ACCENT,
} from "./primitives"

const styles = StyleSheet.create({
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
    marginTop: 8,
  },
  recipientColumn: {
    flex: 1,
    marginRight: 16,
  },
  metaColumn: {
    flex: 1,
    alignItems: "flex-end",
  },
  sectionLabel: {
    fontSize: 8,
    textTransform: "uppercase",
    color: PDF_ACCENT,
    marginBottom: 4,
  },
  recipientName: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginBottom: 2,
  },
  recipientLine: {
    fontSize: 10,
    lineHeight: 1.4,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 2,
  },
  metaLabel: {
    fontSize: 9,
    color: "#444444",
    marginRight: 8,
  },
  metaValue: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
  },
  notes: {
    marginTop: 16,
    fontSize: 9,
    color: "#555555",
  },
})

function formatDate(date: Date | null): string {
  if (!date) return "—"
  return date.toISOString().slice(0, 10)
}

export function InvoicePdf(props: { model: InvoicePdfModel }): React.ReactElement {
  const { model } = props
  const addressLines = formatPostalAddress(model.billTo.address)
  return (
    <PageFrame>
      <PdfHeader docType="FACTURE" logoUrl={model.billFrom.logoUrl} emitterName={model.billFrom.name} />
      <View style={contentPadding}>
        <View style={styles.infoRow}>
          <View style={styles.recipientColumn}>
            <Text style={styles.sectionLabel}>Destinataire</Text>
            <Text style={styles.recipientName}>{model.billTo.name}</Text>
            {model.billTo.email ? <Text style={styles.recipientLine}>{model.billTo.email}</Text> : null}
            {addressLines.map((line, i) => (
              <Text key={i} style={styles.recipientLine}>{line}</Text>
            ))}
            {model.billTo.phone ? <Text style={styles.recipientLine}>{model.billTo.phone}</Text> : null}
          </View>
          <View style={styles.metaColumn}>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>N° de facture</Text>
              <Text style={styles.metaValue}>{model.number}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Date d&apos;émission</Text>
              <Text style={styles.metaValue}>{formatDate(model.issuedAt)}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Date d&apos;échéance</Text>
              <Text style={styles.metaValue}>{formatDate(model.dueAt)}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Statut</Text>
              <Text style={styles.metaValue}>{model.status}</Text>
            </View>
          </View>
        </View>
        <ItemsTable items={model.items} />
        <TotalsBlock
          totalHtCents={model.totalHtCents}
          vatCents={model.vatCents}
          totalTtcCents={model.totalTtcCents}
        />
        {model.notes ? <Text style={styles.notes}>{model.notes}</Text> : null}
        <LegalFooter />
      </View>
    </PageFrame>
  )
}
