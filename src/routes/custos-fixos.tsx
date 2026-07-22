import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/custos-fixos")({
  beforeLoad: () => {
    throw redirect({ to: "/pacientes" });
  },
  component: () => null,
});
