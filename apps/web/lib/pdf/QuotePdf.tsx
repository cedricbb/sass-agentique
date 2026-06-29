import React from "react"
import { View, Text, StyleSheet } from "@react-pdf/renderer"
import type { QuotePdfModel } from "@saas/services/quote-pdf.shared"
import { formatPostalAddress } from "@saas/services/billing-party.shared"
import { formatDate } from "../format"
import {
  PageFrame,
  ItemsTable,
  TotalsBlock,
  PdfFooter,
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


export function QuotePdf(props: { model: QuotePdfModel }): React.ReactElement {
  const { model } = props
  const addressLines = formatPostalAddress(model.billTo.address)
  return (
    <PageFrame>
      <PdfHeader docType="DEVIS" logoUrl={model.billFrom.logoUrl} emitterName={model.billFrom.name} />
      <View style={contentPadding}>
        <View style={styles.infoRow}>
          <View style={styles.recipientColumn}>
            <Text style={styles.sectionLabel}>Destinataire</Text>
            <Text style={styles.recipientName}>{model.billTo.name}</Text>
            {model.billTo.attention ? <Text style={styles.recipientLine}>À l&apos;attention de {model.billTo.attention}</Text> : null}
            {model.billTo.email ? <Text style={styles.recipientLine}>{model.billTo.email}</Text> : null}
            {addressLines.map((line, i) => (
              <Text key={i} style={styles.recipientLine}>{line}</Text>
            ))}
            {model.billTo.phone ? <Text style={styles.recipientLine}>{model.billTo.phone}</Text> : null}
            {model.billTo.siret ? <Text style={styles.recipientLine}>SIRET : {model.billTo.siret}</Text> : null}
            {model.billTo.tvaIntra ? <Text style={styles.recipientLine}>TVA : {model.billTo.tvaIntra}</Text> : null}
          </View>
          <View style={styles.metaColumn}>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>N° de devis</Text>
              <Text style={styles.metaValue}>{model.number}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Date d&apos;émission</Text>
              <Text style={styles.metaValue}>{formatDate(model.issuedAt)}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Date de validité</Text>
              <Text style={styles.metaValue}>{formatDate(model.expiresAt)}</Text>
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
      </View>
      <PdfFooter billFrom={model.billFrom} />
    </PageFrame>
  )
}
