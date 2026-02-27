import { describe, it, expect } from "vitest";
import {
  tenants,
  users,
  memberships,
  sessions,
  agentTasks,
  agentLogs,
  membershipRoleEnum,
} from "../schema";

describe("schema — exports", () => {
  it("exporte toutes les tables attendues", () => {
    expect(tenants).toBeDefined();
    expect(users).toBeDefined();
    expect(memberships).toBeDefined();
    expect(sessions).toBeDefined();
    expect(agentTasks).toBeDefined();
    expect(agentLogs).toBeDefined();
  });

  it("exporte l'enum membershipRole", () => {
    expect(membershipRoleEnum).toBeDefined();
  });
});

describe("schema — table tenants", () => {
  it("a le bon nom de table", () => {
    expect(tenants[Symbol.for("drizzle:Name")]).toBe("tenants");
  });

  it("contient les colonnes attendues", () => {
    const cols = Object.keys(tenants);
    expect(cols).toContain("id");
    expect(cols).toContain("slug");
    expect(cols).toContain("name");
    expect(cols).toContain("plan");
    expect(cols).toContain("stripeCustomerId");
    expect(cols).toContain("createdAt");
    expect(cols).toContain("updatedAt");
  });
});

describe("schema — table users", () => {
  it("a le bon nom de table", () => {
    expect(users[Symbol.for("drizzle:Name")]).toBe("users");
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

describe("schema — table memberships", () => {
  it("a le bon nom de table", () => {
    expect(memberships[Symbol.for("drizzle:Name")]).toBe("memberships");
  });

  it("contient userId, tenantId et role", () => {
    const cols = Object.keys(memberships);
    expect(cols).toContain("userId");
    expect(cols).toContain("tenantId");
    expect(cols).toContain("role");
  });
});

describe("schema — table sessions", () => {
  it("a le bon nom de table", () => {
    expect(sessions[Symbol.for("drizzle:Name")]).toBe("sessions");
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
    expect(agentTasks[Symbol.for("drizzle:Name")]).toBe("agent_tasks");
  });

  it("contient tenantId, agentType, status, payload, result", () => {
    const cols = Object.keys(agentTasks);
    expect(cols).toContain("tenantId");
    expect(cols).toContain("agentType");
    expect(cols).toContain("status");
    expect(cols).toContain("payload");
    expect(cols).toContain("result");
  });
});

describe("schema — table agent_logs", () => {
  it("a le bon nom de table", () => {
    expect(agentLogs[Symbol.for("drizzle:Name")]).toBe("agent_logs");
  });

  it("contient taskId, level et message", () => {
    const cols = Object.keys(agentLogs);
    expect(cols).toContain("taskId");
    expect(cols).toContain("level");
    expect(cols).toContain("message");
  });
});
