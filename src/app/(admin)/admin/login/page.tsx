import type { Metadata } from "next";
import { Suspense } from "react";
import { StaffLoginForm } from "@/components/admin/StaffLoginForm";
import { staffPasscode } from "@/lib/admin/auth";

export const metadata: Metadata = { title: "Staff sign in" };

/**
 * The form reads `?next=` to send staff back where they were headed, and
 * `useSearchParams` needs a Suspense boundary to prerender.
 */
export default function StaffLoginPage() {
  return (
    <Suspense fallback={null}>
      {/*
        The demo passcode is only shown while the published default is still in
        use. Once a deployment sets ADMIN_PASSCODE, the hint disappears rather
        than printing someone's real secret on the sign-in page.
      */}
      <StaffLoginForm demoPasscode={staffPasscode() === "urbantable" ? "urbantable" : null} />
    </Suspense>
  );
}
