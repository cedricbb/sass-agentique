import { describe, it, expect, vi, beforeEach } from "vitest";

const makeDrizzleMock = () => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = [
    "select", "from", "where", "orderBy", "limit",
    "insert", "values", "returning",
    "update", "set",
    "delete",
    "transaction",
  ];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnThis();
  }
  return chain;
};

let dbMock = makeDrizzleMock();

vi.mock("@saas/db", () => ({
  get db() { return dbMock; },
  reports: {},
  reportKindEnum: { enumValues: ["delivery", "monthly", "audit", "other"] },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a: unknown, b: unknown) => ({ field: a, value: b })),
  and: vi.fn((...args: unknown[]) => ({ and: args })),
  isNull: vi.fn((a: unknown) => ({ isNull: a })),
  isNotNull: vi.fn((a: unknown) => ({ isNotNull: a })),
  desc: vi.fn((a: unknown) => ({ desc: a })),
  count: vi.fn(() => "count"),
}));

import { eq, and, isNull, isNotNull, desc } from "drizzle-orm";
import {
  listReportsByClient,
  listReportsByProject,
  listAllReports,
  getReportById,
  createReport,
  updateReport,
  markReportIssued,
  deleteReport,
  InvalidFilePathError,
  countIssuedReportsForClient,
} from "../report.service";

function mockDbReturns(result: unknown) {
  dbMock.returning.mockResolvedValue(result);
  dbMock.orderBy.mockResolvedValue(result);
  dbMock.limit.mockResolvedValue(result);
  dbMock.where.mockImplementation(() => {
    return {
      returning: dbMock.returning,
      orderBy: dbMock.orderBy,
      limit: dbMock.limit,
      then: (resolve: (v: unknown) => void) => resolve(result),
    };
  });
}

const fixture = {
  id: "r-1",
  clientId: "c-1",
  projectId: "p-1",
  title: "Monthly Report",
  kind: "delivery" as const,
  filePath: "/reports/r-1.pdf",
  summary: null,
  issuedAt: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

describe("report.service", () => {
  beforeEach(() => {
    dbMock = makeDrizzleMock();
    vi.clearAllMocks();
  });

  // #1
  describe("listReportsByClient", () => {
    it("filters by clientId and orders by createdAt DESC", async () => {
      mockDbReturns([fixture]);
      const result = await listReportsByClient("c-1");
      expect(dbMock.select).toHaveBeenCalled();
      expect(dbMock.from).toHaveBeenCalled();
      expect(dbMock.where).toHaveBeenCalled();
      expect(eq).toHaveBeenCalled();
      expect(dbMock.orderBy).toHaveBeenCalled();
      expect(desc).toHaveBeenCalled();
      expect(result).toEqual([fixture]);
    });

    // #2
    it("filters by kind when opts.kind is provided", async () => {
      mockDbReturns([fixture]);
      const result = await listReportsByClient("c-1", { kind: "delivery" });
      expect(and).toHaveBeenCalled();
      expect(result).toEqual([fixture]);
    });

    it("excludes drafts when issuedOnly is true", async () => {
      const issuedFixture = { ...fixture, issuedAt: new Date("2026-01-01") };
      mockDbReturns([issuedFixture]);
      const result = await listReportsByClient("c-1", { issuedOnly: true });
      expect(isNotNull).toHaveBeenCalled();
      expect(and).toHaveBeenCalled();
      expect(result).toEqual([issuedFixture]);
    });

    it("combines kind and issuedOnly filters", async () => {
      mockDbReturns([]);
      await listReportsByClient("c-1", { kind: "delivery", issuedOnly: true });
      expect(and).toHaveBeenCalled();
      const andCallArgs = (and as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(andCallArgs).toHaveLength(3);
    });
  });

  // #3
  describe("listReportsByProject", () => {
    it("filters by projectId and orders by createdAt DESC", async () => {
      mockDbReturns([fixture]);
      const result = await listReportsByProject("p-1");
      expect(dbMock.select).toHaveBeenCalled();
      expect(dbMock.from).toHaveBeenCalled();
      expect(dbMock.where).toHaveBeenCalled();
      expect(eq).toHaveBeenCalled();
      expect(dbMock.orderBy).toHaveBeenCalled();
      expect(desc).toHaveBeenCalled();
      expect(result).toEqual([fixture]);
    });
  });

  // #4
  describe("listAllReports", () => {
    it("returns all reports without filters", async () => {
      mockDbReturns([fixture]);
      const result = await listAllReports();
      expect(dbMock.where).toHaveBeenCalledWith(undefined);
      expect(dbMock.orderBy).toHaveBeenCalled();
      expect(result).toEqual([fixture]);
    });

    // #5
    it("filters by issuedAt IS NULL when undatedOnly is true", async () => {
      mockDbReturns([fixture]);
      const result = await listAllReports({ undatedOnly: true });
      expect(isNull).toHaveBeenCalled();
      expect(result).toEqual([fixture]);
    });
  });

  // #6
  describe("getReportById", () => {
    it("returns report when found or null when not found", async () => {
      const validUUID = "00000000-0000-0000-0000-000000000001";
      mockDbReturns([fixture]);
      const result = await getReportById(validUUID);
      expect(dbMock.where).toHaveBeenCalled();
      expect(eq).toHaveBeenCalled();
      expect(dbMock.limit).toHaveBeenCalledWith(1);
      expect(result).toEqual(fixture);

      // not found
      dbMock = makeDrizzleMock();
      mockDbReturns([]);
      const result2 = await getReportById("missing");
      expect(result2).toBeNull();
    });

    it("returns null without DB call for non-UUID id", async () => {
      const result = await getReportById("not-a-uuid");
      expect(dbMock.select).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it("returns report for valid UUID", async () => {
      const validUUID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
      mockDbReturns([fixture]);
      const result = await getReportById(validUUID);
      expect(dbMock.where).toHaveBeenCalled();
      expect(dbMock.limit).toHaveBeenCalledWith(1);
      expect(result).toEqual(fixture);
    });
  });

  // #7
  describe("createReport", () => {
    it("inserts with trimmed filePath", async () => {
      mockDbReturns([fixture]);
      const input = { clientId: "c-1", title: "T", filePath: "  /path.pdf  ", kind: "delivery" as const };
      await createReport(input as any);
      expect(dbMock.insert).toHaveBeenCalled();
      expect(dbMock.values).toHaveBeenCalled();
      const valuesArg = dbMock.values.mock.calls[0][0];
      expect(valuesArg.filePath).toBe("/path.pdf");
    });

    // #8
    it("throws InvalidFilePathError when filePath is empty or whitespace", async () => {
      await expect(createReport({ clientId: "c-1", title: "T", filePath: "", kind: "delivery" } as any))
        .rejects.toThrow(InvalidFilePathError);
      await expect(createReport({ clientId: "c-1", title: "T", filePath: "   ", kind: "delivery" } as any))
        .rejects.toThrow(InvalidFilePathError);
    });
  });

  // #9
  describe("updateReport", () => {
    it("updates patch with updatedAt and returns report", async () => {
      const before = Date.now();
      mockDbReturns([{ ...fixture, title: "Updated" }]);
      const result = await updateReport("r-1", { title: "Updated" });
      expect(dbMock.set).toHaveBeenCalled();
      const setArg = dbMock.set.mock.calls[0][0];
      expect(setArg.updatedAt).toBeInstanceOf(Date);
      expect(setArg.updatedAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(result).toEqual({ ...fixture, title: "Updated" });
    });

    // #10
    it("throws if patch contains clientId", async () => {
      await expect(updateReport("r-1", { clientId: "c-2" } as any))
        .rejects.toThrow("clientId cannot be updated");
    });

    // #11
    it("throws if patch contains issuedAt", async () => {
      await expect(updateReport("r-1", { issuedAt: new Date() } as any))
        .rejects.toThrow("issuedAt cannot be updated via updateReport");
    });
  });

  // #12
  describe("markReportIssued", () => {
    it("sets issuedAt on a draft report", async () => {
      // First SELECT returns draft report (issuedAt null)
      mockDbReturns([fixture]);
      // Then UPDATE returns updated report
      const issuedDate = new Date("2026-06-01");
      dbMock.returning.mockResolvedValue([{ ...fixture, issuedAt: issuedDate }]);
      const result = await markReportIssued("r-1", issuedDate);
      expect(dbMock.update).toHaveBeenCalled();
      expect(dbMock.set).toHaveBeenCalled();
      expect(result).toEqual({ ...fixture, issuedAt: issuedDate });
    });

    // #13
    it("returns report unchanged if already issued (idempotent)", async () => {
      const issuedReport = { ...fixture, issuedAt: new Date("2026-05-01") };
      dbMock.limit.mockResolvedValue([issuedReport]);
      const result = await markReportIssued("r-1");
      expect(dbMock.update).not.toHaveBeenCalled();
      expect(result).toEqual(issuedReport);
    });

    it("returns null when report not found", async () => {
      dbMock.limit.mockResolvedValue([]);
      const result = await markReportIssued("missing");
      expect(result).toBeNull();
    });
  });

  // #14
  describe("deleteReport", () => {
    it("returns deletedReport in transaction", async () => {
      // Mock transaction to call the callback with dbMock
      dbMock.transaction.mockImplementation(async (cb: (tx: typeof dbMock) => Promise<unknown>) => {
        return cb(dbMock);
      });
      dbMock.limit.mockResolvedValue([fixture]);
      dbMock.where.mockReturnThis();
      const result = await deleteReport("r-1");
      expect(dbMock.transaction).toHaveBeenCalled();
      expect(result).toEqual({ deletedReport: fixture });
    });

    it("returns null when report not found", async () => {
      dbMock.transaction.mockImplementation(async (cb: (tx: typeof dbMock) => Promise<unknown>) => {
        return cb(dbMock);
      });
      dbMock.limit.mockResolvedValue([]);
      dbMock.where.mockReturnThis();
      const result = await deleteReport("missing");
      expect(result).toEqual({ deletedReport: null });
    });
  });

  describe("countIssuedReportsForClient", () => {
    it("count_issued_reports_returns_issued_only", async () => {
      dbMock.where.mockResolvedValueOnce([{ count: 4 }]);
      const result = await countIssuedReportsForClient("c-1");
      expect(result).toBe(4);
      expect(dbMock.where).toHaveBeenCalled();
    });

    it("count_issued_reports_returns_zero_when_none_issued", async () => {
      dbMock.where.mockResolvedValueOnce([{ count: 0 }]);
      const result = await countIssuedReportsForClient("c-1");
      expect(result).toBe(0);
    });
  });
});
