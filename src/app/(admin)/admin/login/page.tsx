import type { Metadata } from "next";
import { Suspense } from "react";
import { StaffLoginForm } from "@/components/admin/StaffLoginForm";
import { ensureStaffData } from "@/lib/staff/staff-repository";

export const metadata: Metadata = { title: "Staff sign in" };

/** The sign-in screen must never be served from a cache built before seeding. */
export const dynamic = "force-dynamic";

/**
 * The form reads `?next=` to send staff back where they were headed, and
 * `useSearchParams` needs a Suspense boundary to prerender.
 */
export default async function StaffLoginPage() {
  // Seeds the roles and the migrated manager account on first boot, so the
  // first person to open this page has something to sign in to.
  await ensureStaffData();

  /*
   * The first-run hint, and only while it is telling nobody anything new.
   *
   * It names the seeded manager and the passcode this repository publishes. A
   * deployment that set `ADMIN_PASSCODE` has a secret of its own, and this
   * prints nothing rather than putting it on a public page.
   */
  const usingPublishedDefault = (process.env.ADMIN_PASSCODE ?? "urbantable") === "urbantable";
  const seedHint = usingPublishedDefault
    ? {
        username: (process.env.SEED_MANAGER_USERNAME ?? "manager").toLowerCase(),
        password: "urbantable",
      }
    : null;

  return (
    <Suspense fallback={null}>
      <StaffLoginForm seedHint={seedHint} />
    </Suspense>
  );
}
