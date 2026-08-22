import type { Metadata } from "next";
import { Suspense } from "react";
import { StaffLoginForm } from "@/components/admin/StaffLoginForm";

export const metadata: Metadata = { title: "Staff sign in" };

/**
 * The form reads `?next=` to send staff back where they were headed, and
 * `useSearchParams` needs a Suspense boundary to prerender.
 */
export default function StaffLoginPage() {
  return (
    <Suspense fallback={null}>
      <StaffLoginForm />
    </Suspense>
  );
}
