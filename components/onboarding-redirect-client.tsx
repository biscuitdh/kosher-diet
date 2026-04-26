"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function OnboardingRedirectClient() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/generate");
  }, [router]);

  return (
    <Card className="mx-auto max-w-xl">
      <CardHeader>
        <CardTitle>Profile setup moved</CardTitle>
        <CardDescription>KosherTable now uses one fixed safety profile and sends old profile links to the recipe finder.</CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild>
          <Link href="/generate">Open recipe finder</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
