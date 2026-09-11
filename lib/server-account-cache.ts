import "server-only";

import { createAccountCache } from "@/lib/account-cache";
import type { DashboardUser } from "@/lib/types";

export const accountCache = createAccountCache<DashboardUser>();
