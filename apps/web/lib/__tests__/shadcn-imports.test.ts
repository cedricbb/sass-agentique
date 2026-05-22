import { describe, test, expect } from "vitest";

const components: [string, string][] = [
  ["alert", "Alert"],
  ["alert-dialog", "AlertDialog"],
  ["avatar", "Avatar"],
  ["badge", "Badge"],
  ["breadcrumb", "Breadcrumb"],
  ["button", "Button"],
  ["calendar", "Calendar"],
  ["card", "Card"],
  ["checkbox", "Checkbox"],
  ["command", "Command"],
  ["dialog", "Dialog"],
  ["dropdown-menu", "DropdownMenu"],
  ["form", "Form"],
  ["input", "Input"],
  ["label", "Label"],
  ["popover", "Popover"],
  ["radio-group", "RadioGroup"],
  ["scroll-area", "ScrollArea"],
  ["select", "Select"],
  ["separator", "Separator"],
  ["sheet", "Sheet"],
  ["skeleton", "Skeleton"],
  ["sonner", "Toaster"],
  ["switch", "Switch"],
  ["table", "Table"],
  ["tabs", "Tabs"],
  ["textarea", "Textarea"],
  ["tooltip", "Tooltip"],
];

describe("shadcn/ui components", () => {
  test.each(components)(
    "%s exports %s",
    async (path, exportName) => {
      const mod = await import(`@/components/ui/${path}`);
      expect(mod[exportName]).toBeDefined();
    },
    15_000,
  );
});
