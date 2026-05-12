import { describe, it, expect } from "vitest";
import { getTableName } from "drizzle-orm";
import {
  users,
  sessions,
  agentTasks,
  agentLogs,
  userRoleEnum,
} from "../schema";

describe("schema — exports", () => {
  it("exporte toutes les tables attendues", () => {
    expect(users).toBeDefined();
    expect(sessions).toBeDefined();
    expect(agentTasks).toBeDefined();
    expect(agentLogs).toBeDefined();
  });

  it("exporte l'enum userRole", () => {
    expect(userRoleEnum).toBeDefined();
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

describe("schema — enum userRole", () => {
  it("a le nom d'enum user_role", () => {
    expect(userRoleEnum.enumName).toBe("user_role");
  });

  it("contient les valeurs admin et client", () => {
    expect(userRoleEnum.enumValues).toEqual(["admin", "client"]);
  });
});
