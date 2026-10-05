import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/ipc/$id")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/ipm/$id", params: { id: params.id }, replace: true });
  },
});