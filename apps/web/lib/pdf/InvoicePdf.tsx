import React from "react"
import { View, Text, StyleSheet } from "@react-pdf/renderer"
import type { InvoicePdfModel } from "@saas/services/invoice-pdf.shared"
import {
  PageFrame,
  PartyBlock,
  ItemsTable,
  TotalsBlock,
  LegalFooter,
} from "./primitives"

const styles = StyleSheet.create({
  header: {
    marginBottom: 24,
  },
  invoiceNumber: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  headerMeta: {
    fontSize: 10,
    marginBottom: 2,
    color: "#444444",
  },
  partiesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  partyColumn: {
    flex: 1,
    marginRight: 16,
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
  return (
    <PageFrame>
      <View style={styles.header}>
        <Text style={styles.invoiceNumber}>Facture {model.number}</Text>
        <Text style={styles.headerMeta}>Statut : {model.status}</Text>
        <Text style={styles.headerMeta}>Date d&apos;émission : {formatDate(model.issuedAt)}</Text>
        <Text style={styles.headerMeta}>Date d&apos;échéance : {formatDate(model.dueAt)}</Text>
      </View>
      <View style={styles.partiesRow}>
        <View style={styles.partyColumn}>
          <PartyBlock label="Émetteur" party={model.billFrom} />
        </View>
        <View style={styles.partyColumn}>
          <PartyBlock label="Destinataire" party={model.billTo} />
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
    </PageFrame>
  )
}
