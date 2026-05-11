#!/bin/bash
# AC tests for pivot-r2-schema-0: Cleanup apps/web multi-tenant
set -euo pipefail
PASS=0; FAIL=0

check() {
  local label="$1"; shift
  if eval "$@" >/dev/null 2>&1; then
    echo "PASS: $label"; PASS=$((PASS+1))
  else
    echo "FAIL: $label"; FAIL=$((FAIL+1))
  fi
}

# AC1 — 4 files deleted
check "AC1a tenants/page.tsx deleted"      '! test -e apps/web/app/\(admin\)/admin/tenants/page.tsx'
check "AC1b accept-invitation deleted"     '! test -e apps/web/app/\(auth\)/accept-invitation/page.tsx'
check "AC1c actions/tenant.ts deleted"     '! test -e apps/web/app/actions/tenant.ts'
check "AC1d TenantInfo.tsx deleted"        '! test -e apps/web/components/tenant/TenantInfo.tsx'

# AC2 — Sidebar sans lien /admin/tenants
check "AC2 no /admin/tenants in sidebar"   '! grep -q "/admin/tenants" apps/web/components/admin/AdminSidebar.tsx'

# AC3 — No residual references in apps/web
check "AC3a no TenantInfo ref"             '! grep -rn "TenantInfo" apps/web/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v .next | grep -q .'
check "AC3b no /admin/tenants ref"         '! grep -rn "/admin/tenants" apps/web/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v .next | grep -q .'
check "AC3c no accept-invitation ref"      '! grep -rn "accept-invitation" apps/web/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v .next | grep -q .'
check "AC3d no actions/tenant ref"         '! grep -rn "actions/tenant" apps/web/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v .next | grep -q .'
check "AC3e no changeTenantPlan ref"       '! grep -rn "changeTenantPlan" apps/web/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v .next | grep -q .'

# AC6 — Building2 not in sidebar (if unused elsewhere)
check "AC6 no Building2 in sidebar"        '! grep -q "Building2" apps/web/components/admin/AdminSidebar.tsx'

echo "---"
echo "Results: $PASS passed, $FAIL failed out of $((PASS+FAIL))"
[ "$FAIL" -eq 0 ]
