import React from "react";
import { Html, Head, Body, Container, Heading, Text, Button, Hr } from "@react-email/components";
import { render } from "@react-email/render";

export type QuoteSentEmailProps = {
  quoteNumber: string;
  clientName: string;
  totalTtcFormatted: string;
  ctaUrl: string;
};

export function QuoteSentEmail({ quoteNumber, clientName, totalTtcFormatted, ctaUrl }: QuoteSentEmailProps): React.ReactElement {
  return (
    <Html>
      <Head />
      <Body>
        <Container>
          <Heading>Nouveau devis {quoteNumber} disponible</Heading>
          <Text>Bonjour {clientName},</Text>
          <Text>
            Un nouveau devis ({quoteNumber}) d&apos;un montant de {totalTtcFormatted} TTC est disponible.
          </Text>
          <Button href={ctaUrl}>Consulter le devis</Button>
          <Hr />
          <Text>Ce message est envoyé automatiquement.</Text>
        </Container>
      </Body>
    </Html>
  );
}

export async function renderQuoteSentHtml(props: QuoteSentEmailProps): Promise<string> {
  return render(<QuoteSentEmail {...props} />);
}
