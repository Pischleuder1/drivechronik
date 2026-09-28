"use client";

import { usePathname } from "next/navigation";

export function MobileAppHeaderGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const hasOwnMobileHeader =
    pathname === "/day" ||
    pathname.startsWith("/day/");

  if (hasOwnMobileHeader) {
    return (
      <style>{`
        @media (max-width: 767px) {
          html,
          body,
          .mobile-app-shell {
            background: #071421 !important;
          }
        }
      `}</style>
    );
  }

  return <>{children}</>;
}
