import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/procedimentos")({
  beforeLoad: () => {
    throw redirect({ to: "/pacientes" });
  },
  component: () => null,
});
