import { describe, it, expect } from "vitest";
import { getTableName } from "drizzle-orm";
import {
  users,
  sessions,
  agentTasks,
  agentLogs,
  userRoleEnum,
  clients,
  clientContacts,
  projects,
  clientTypeEnum,
  projectStatusEnum,
  quotes,
  quoteItems,
  invoices,
  invoiceItems,
  payments,
  quoteStatusEnum,
  invoiceStatusEnum,
  paymentMethodEnum,
  reports,
  prestations,
  maintenanceContracts,
  reportKindEnum,
  prestationKindEnum,
  billingModeEnum,
  maintenanceStatusEnum,
} from "../schema";

describe("schema — exports", () => {
  it("exporte toutes les tables attendues", () => {
    expect(users).toBeDefined();
    expect(sessions).toBeDefined();
    expect(agentTasks).toBeDefined();
    expect(agentLogs).toBeDefined();
    expect(clients).toBeDefined();
    expect(clientContacts).toBeDefined();
    expect(projects).toBeDefined();
    expect(quotes).toBeDefined();
    expect(quoteItems).toBeDefined();
    expect(invoices).toBeDefined();
    expect(invoiceItems).toBeDefined();
    expect(payments).toBeDefined();
    expect(reports).toBeDefined();
    expect(prestations).toBeDefined();
    expect(maintenanceContracts).toBeDefined();
  });

  it("exporte les enums reportKind, prestationKind, billingMode et maintenanceStatus", () => {
    expect(reportKindEnum).toBeDefined();
    expect(prestationKindEnum).toBeDefined();
    expect(billingModeEnum).toBeDefined();
    expect(maintenanceStatusEnum).toBeDefined();
  });

  it("exporte les enums quoteStatus, invoiceStatus et paymentMethod", () => {
    expect(quoteStatusEnum).toBeDefined();
    expect(invoiceStatusEnum).toBeDefined();
    expect(paymentMethodEnum).toBeDefined();
  });

  it("exporte l'enum userRole", () => {
    expect(userRoleEnum).toBeDefined();
  });

  it("exporte les enums clientType et projectStatus", () => {
    expect(clientTypeEnum).toBeDefined();
    expect(projectStatusEnum).toBeDefined();
  });
});

describe("schema — table users", () => {
  it("a le bon nom de table", () => {
    expect(getTableName(users)).toBe("users");
  });

  it("contient les colonnes auth attendues", () => {
    const cols = Object.keys(users);
    expect(cols).toContain("id");
    expect(cols).toContain("email");
    expect(cols).toContain("hashedPassword");
    expect(cols).toContain("totpSecret");
    expect(cols).toContain("role");
  });
});

describe("schema — table sessions", () => {
  it("a le bon nom de table", () => {
    expect(getTableName(sessions)).toBe("sessions");
  });

  it("contient userId et sessionToken", () => {
    const cols = Object.keys(sessions);
    expect(cols).toContain("userId");
    expect(cols).toContain("sessionToken");
    expect(cols).toContain("expires");
  });
});

describe("schema — table agent_tasks", () => {
  it("a le bon nom de table", () => {
    expect(getTableName(agentTasks)).toBe("agent_tasks");
  });

  it("contient agentType, status, payload, result", () => {
    const cols = Object.keys(agentTasks);
    expect(cols).toContain("agentType");
    expect(cols).toContain("status");
    expect(cols).toContain("payload");
    expect(cols).toContain("result");
  });
});

describe("schema — table agent_logs", () => {
  it("a le bon nom de table", () => {
    expect(getTableName(agentLogs)).toBe("agent_logs");
  });

  it("contient taskId, level et message", () => {
    const cols = Object.keys(agentLogs);
    expect(cols).toContain("taskId");
    expect(cols).toContain("level");
    expect(cols).toContain("message");
  });
});

describe("schema — table clients", () => {
  it("a le bon nom de table", () => {
    expect(getTableName(clients)).toBe("clients");
  });
  it("contient les colonnes attendues", () => {
    const cols = Object.keys(clients);
    for (const col of ["id", "ownerId", "name", "slug", "type", "email", "phone",
      "billingAddress", "notes", "archivedAt", "createdAt", "updatedAt"]) {
      expect(cols).toContain(col);
    }
  });
});

describe("schema — table client_contacts", () => {
  it("a le bon nom de table", () => {
    expect(getTableName(clientContacts)).toBe("client_contacts");
  });
  it("contient clientId, userId, isPrimary, role", () => {
    const cols = Object.keys(clientContacts);
    for (const col of ["clientId", "userId", "isPrimary", "role"]) {
      expect(cols).toContain(col);
    }
  });
});

describe("schema — table projects", () => {
  it("a le bon nom de table", () => {
    expect(getTableName(projects)).toBe("projects");
  });
  it("contient les colonnes attendues", () => {
    const cols = Object.keys(projects);
    for (const col of ["id", "ownerId", "clientId", "name", "slug", "status",
      "description", "startedAt", "deliveredAt"]) {
      expect(cols).toContain(col);
    }
  });
});

describe("schema — enum clientType", () => {
  it("a le bon nom d'enum", () => {
    expect(clientTypeEnum.enumName).toBe("client_type");
  });
  it("contient company et individual", () => {
    expect(clientTypeEnum.enumValues).toEqual(["company", "individual"]);
  });
});

describe("schema — enum projectStatus", () => {
  it("a le bon nom d'enum", () => {
    expect(projectStatusEnum.enumName).toBe("project_status");
  });
  it("contient les 5 statuts", () => {
    expect(projectStatusEnum.enumValues).toEqual(
      ["draft", "active", "on_hold", "delivered", "cancelled"]
    );
  });
});

describe("schema — enum userRole", () => {
  it("a le nom d'enum user_role", () => {
    expect(userRoleEnum.enumName).toBe("user_role");
  });

  it("contient les valeurs admin et client", () => {
    expect(userRoleEnum.enumValues).toEqual(["admin", "client"]);
  });
});

describe("schema — table quotes", () => {
  it("a le bon nom de table", () => {
    expect(getTableName(quotes)).toBe("quotes");
  });
  it("contient les colonnes attendues", () => {
    const cols = Object.keys(quotes);
    for (const col of ["id", "ownerId", "clientId", "projectId", "number", "status",
      "issuedAt", "expiresAt", "acceptedAt", "totalEurCents", "vatRateBps",
      "notes", "createdAt", "updatedAt"]) {
      expect(cols).toContain(col);
    }
  });
});

describe("schema — table quote_items", () => {
  it("a le bon nom de table", () => {
    expect(getTableName(quoteItems)).toBe("quote_items");
  });
  it("contient les colonnes attendues", () => {
    const cols = Object.keys(quoteItems);
    for (const col of ["id", "quoteId", "prestationId", "description",
      "quantity", "unitPriceEurCents", "sortOrder"]) {
      expect(cols).toContain(col);
    }
  });
});

describe("schema — table invoices", () => {
  it("a le bon nom de table", () => {
    expect(getTableName(invoices)).toBe("invoices");
  });
  it("contient les colonnes attendues", () => {
    const cols = Object.keys(invoices);
    for (const col of ["id", "ownerId", "clientId", "quoteId", "projectId", "number",
      "status", "issuedAt", "dueAt", "paidAt", "totalEurCents", "vatRateBps",
      "stripePaymentIntentId", "stripeCheckoutSessionId", "notes",
      "createdAt", "updatedAt"]) {
      expect(cols).toContain(col);
    }
  });
});

describe("schema — table invoice_items", () => {
  it("a le bon nom de table", () => {
    expect(getTableName(invoiceItems)).toBe("invoice_items");
  });
  it("contient les colonnes attendues", () => {
    const cols = Object.keys(invoiceItems);
    for (const col of ["id", "invoiceId", "description", "quantity",
      "unitPriceEurCents", "sortOrder"]) {
      expect(cols).toContain(col);
    }
  });
});

describe("schema — table payments", () => {
  it("a le bon nom de table", () => {
    expect(getTableName(payments)).toBe("payments");
  });
  it("contient les colonnes attendues", () => {
    const cols = Object.keys(payments);
    for (const col of ["id", "ownerId", "invoiceId", "amountEurCents", "method",
      "externalRef", "paidAt", "notes", "createdAt"]) {
      expect(cols).toContain(col);
    }
  });
});

describe("schema — enum quoteStatus", () => {
  it("a le bon nom d'enum", () => {
    expect(quoteStatusEnum.enumName).toBe("quote_status");
  });
  it("contient les 5 statuts", () => {
    expect(quoteStatusEnum.enumValues).toEqual(
      ["draft", "sent", "accepted", "declined", "expired"]
    );
  });
});

describe("schema — enum invoiceStatus", () => {
  it("a le bon nom d'enum", () => {
    expect(invoiceStatusEnum.enumName).toBe("invoice_status");
  });
  it("contient les 5 statuts", () => {
    expect(invoiceStatusEnum.enumValues).toEqual(
      ["draft", "sent", "paid", "overdue", "cancelled"]
    );
  });
});

describe("schema — enum paymentMethod", () => {
  it("a le bon nom d'enum", () => {
    expect(paymentMethodEnum.enumName).toBe("payment_method");
  });
  it("contient les 3 méthodes", () => {
    expect(paymentMethodEnum.enumValues).toEqual(
      ["stripe_card", "bank_transfer", "other"]
    );
  });
});

describe("schema — table reports", () => {
  it("a le bon nom de table", () => {
    expect(getTableName(reports)).toBe("reports");
  });
  it("contient les colonnes attendues", () => {
    const cols = Object.keys(reports);
    for (const col of ["id", "ownerId", "clientId", "projectId", "title", "kind",
      "filePath", "summary", "issuedAt", "createdAt", "updatedAt"]) {
      expect(cols).toContain(col);
    }
  });
});

describe("schema — table prestations", () => {
  it("a le bon nom de table", () => {
    expect(getTableName(prestations)).toBe("prestations");
  });
  it("contient les colonnes attendues", () => {
    const cols = Object.keys(prestations);
    for (const col of ["id", "ownerId", "slug", "name", "description", "basePriceEurCents",
      "kind", "stripeProductId", "stripePriceId", "isActive", "sortOrder",
      "createdAt", "updatedAt"]) {
      expect(cols).toContain(col);
    }
  });
});

describe("schema — table maintenance_contracts", () => {
  it("a le bon nom de table", () => {
    expect(getTableName(maintenanceContracts)).toBe("maintenance_contracts");
  });
  it("contient les colonnes attendues", () => {
    const cols = Object.keys(maintenanceContracts);
    for (const col of ["id", "ownerId", "clientId", "prestationId", "billingMode",
      "status", "stripeSubscriptionId", "stripeCustomerId",
      "monthlyPriceEurCents", "currentPeriodStart", "currentPeriodEnd",
      "startedAt", "canceledAt", "createdAt", "updatedAt"]) {
      expect(cols).toContain(col);
    }
  });
});

describe("schema — enum reportKind", () => {
  it("a le bon nom d'enum", () => {
    expect(reportKindEnum.enumName).toBe("report_kind");
  });
  it("contient les 4 types", () => {
    expect(reportKindEnum.enumValues).toEqual(
      ["delivery", "monthly", "audit", "other"]
    );
  });
});

describe("schema — enum prestationKind", () => {
  it("a le bon nom d'enum", () => {
    expect(prestationKindEnum.enumName).toBe("prestation_kind");
  });
  it("contient les 2 types", () => {
    expect(prestationKindEnum.enumValues).toEqual(
      ["one_shot", "recurring"]
    );
  });
});

describe("schema — enum billingMode", () => {
  it("a le bon nom d'enum", () => {
    expect(billingModeEnum.enumName).toBe("billing_mode");
  });
  it("contient stripe_auto et manual_invoice", () => {
    expect(billingModeEnum.enumValues).toEqual(
      ["stripe_auto", "manual_invoice"]
    );
  });
});

describe("schema — enum maintenanceStatus", () => {
  it("a le bon nom d'enum", () => {
    expect(maintenanceStatusEnum.enumName).toBe("maintenance_status");
  });
  it("contient les 3 statuts", () => {
    expect(maintenanceStatusEnum.enumValues).toEqual(
      ["active", "past_due", "canceled"]
    );
  });
});
