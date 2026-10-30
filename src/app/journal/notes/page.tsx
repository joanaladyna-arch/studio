"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Les sous-pages du Journal sont devenues des onglets de /journal.
export default function Redirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/journal?tab=notes"); }, [router]);
  return null;
}
