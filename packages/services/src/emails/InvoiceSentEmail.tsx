import React from "react";
import { Html, Head, Body, Container, Heading, Text, Button, Hr } from "@react-email/components";
import { render } from "@react-email/render";

export type InvoiceSentEmailProps = {
  invoiceNumber: string;
  clientName: string;
  totalTtcFormatted: string;
  dueDateFormatted: string | null;
  ctaUrl: string;
};

export function InvoiceSentEmail({ invoiceNumber, clientName, totalTtcFormatted, dueDateFormatted, ctaUrl }: InvoiceSentEmailProps): React.ReactElement {
  return (
    <Html>
      <Head />
      <Body>
        <Container>
          <Heading>Nouvelle facture {invoiceNumber} disponible</Heading>
          <Text>Bonjour {clientName},</Text>
          <Text>
            Une nouvelle facture ({invoiceNumber}) d&apos;un montant de {totalTtcFormatted} TTC est disponible.
          </Text>
          {dueDateFormatted && (
            <Text>Date d&apos;échéance : {dueDateFormatted}</Text>
          )}
          <Button href={ctaUrl}>Consulter la facture</Button>
          <Hr />
          <Text>Ce message est envoyé automatiquement.</Text>
        </Container>
      </Body>
    </Html>
  );
}

export async function renderInvoiceSentHtml(props: InvoiceSentEmailProps): Promise<string> {
  return render(<InvoiceSentEmail {...props} />);
}
