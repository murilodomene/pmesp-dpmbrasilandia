import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/ipc/")({
  beforeLoad: () => {
    throw redirect({ to: "/ipm", replace: true });
  },
});