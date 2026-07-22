import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/precificar")({
  beforeLoad: () => {
    throw redirect({ to: "/pacientes" });
  },
  component: () => null,
});
