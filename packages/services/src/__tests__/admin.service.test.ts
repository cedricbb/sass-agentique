import { describe, it, expect, vi, beforeEach } from "vitest";

const makeDrizzleMock = () => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = [
    "select", "from", "where", "orderBy", "limit", "offset",
  ];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnThis();
  }
  return chain;
};

let dbMock = makeDrizzleMock();

vi.mock("@saas/db", () => ({
  get db() { return dbMock; },
  agentTasks: {
    id: "id",
    agentType: "agentType",
    status: "status",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  },
  agentLogs: {
    taskId: "taskId",
    createdAt: "createdAt",
  },
  users: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a: unknown, b: unknown) => ({ field: a, value: b })),
  desc: vi.fn((a: unknown) => ({ desc: a })),
  count: vi.fn(() => "count"),
  isNotNull: vi.fn(),
  sql: vi.fn(),
  ilike: vi.fn(),
  or: vi.fn(),
}));

describe("admin.service", () => {
  beforeEach(() => {
    dbMock = makeDrizzleMock();
    vi.clearAllMocks();
  });

  describe("AdminAgentTask type contract", () => {
    it("should not include tenantId or tenantName", async () => {
      const taskRow = {
        id: "abc-123",
        agentType: "sync",
        status: "completed",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      dbMock.offset = vi.fn().mockResolvedValue([taskRow]);
      dbMock.where = vi.fn().mockImplementation(function (this: typeof dbMock) {
        return { ...this, then: (resolve: (v: unknown) => void) => resolve([{ count: 1 }]) };
      });

      const selectPromise = Promise.resolve([taskRow]);
      const countPromise = Promise.resolve([{ count: 1 }]);
      dbMock.select = vi.fn().mockReturnThis();
      dbMock.from = vi.fn().mockReturnThis();
      dbMock.where = vi.fn().mockReturnThis();
      dbMock.orderBy = vi.fn().mockReturnThis();
      dbMock.limit = vi.fn().mockReturnThis();
      dbMock.offset = vi.fn()
        .mockReturnValueOnce(selectPromise);

      const mockAll = vi.fn()
        .mockResolvedValueOnce([taskRow])
        .mockResolvedValueOnce([{ count: 1 }]);

      dbMock.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([taskRow]),
              }),
            }),
            then: undefined,
          }),
        }),
      });

      const countChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 1 }]),
        }),
      };

      let callCount = 0;
      dbMock.select = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    offset: vi.fn().mockResolvedValue([taskRow]),
                  }),
                }),
              }),
            }),
          };
        }
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 1 }]),
          }),
        };
      });

      const { listAdminAgentTasks } = await import("../admin.service");
      const { tasks } = await listAdminAgentTasks();

      expect(tasks[0]).not.toHaveProperty("tenantId");
      expect(tasks[0]).not.toHaveProperty("tenantName");
      expect(tasks[0]).toHaveProperty("id");
      expect(tasks[0]).toHaveProperty("agentType");
      expect(tasks[0]).toHaveProperty("status");
    });

    it("should not reference tenantId in select columns", async () => {
      const { listAdminAgentTasks } = await import("../admin.service");

      let callCount = 0;
      let selectArg: unknown;
      dbMock.select = vi.fn().mockImplementation((arg: unknown) => {
        callCount++;
        if (callCount === 1) {
          selectArg = arg;
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    offset: vi.fn().mockResolvedValue([]),
                  }),
                }),
              }),
            }),
          };
        }
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 0 }]),
          }),
        };
      });

      await listAdminAgentTasks();

      expect(selectArg).toBeDefined();
      expect(selectArg).not.toHaveProperty("tenantId");
    });

    it("should return empty array for no results", async () => {
      const { listAdminAgentTasks } = await import("../admin.service");

      let callCount = 0;
      dbMock.select = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    offset: vi.fn().mockResolvedValue([]),
                  }),
                }),
              }),
            }),
          };
        }
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 0 }]),
          }),
        };
      });

      const { tasks, total } = await listAdminAgentTasks();
      expect(tasks).toEqual([]);
      expect(total).toBe(0);
    });
  });
});
