import React from "react";
import { Html, Head, Body, Container, Heading, Text, Button, Hr } from "@react-email/components";
import { render } from "@react-email/render";

export type ReportIssuedEmailProps = {
  reportTitle: string;
  kindLabel: string;
  clientName: string;
  issuedAtFormatted: string;
  ctaUrl: string;
};

export function ReportIssuedEmail({ reportTitle, kindLabel, clientName, issuedAtFormatted, ctaUrl }: ReportIssuedEmailProps): React.ReactElement {
  return (
    <Html>
      <Head />
      <Body>
        <Container>
          <Heading>Rapport {kindLabel} disponible</Heading>
          <Text>Bonjour {clientName},</Text>
          <Text>
            Le rapport &quot;{reportTitle}&quot; ({kindLabel}) est disponible depuis le {issuedAtFormatted}.
          </Text>
          <Button href={ctaUrl}>Consulter le rapport</Button>
          <Hr />
          <Text>Ce message est envoyé automatiquement.</Text>
        </Container>
      </Body>
    </Html>
  );
}

export async function renderReportIssuedHtml(props: ReportIssuedEmailProps): Promise<string> {
  return render(<ReportIssuedEmail {...props} />);
}
