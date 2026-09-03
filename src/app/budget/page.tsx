import { PhasePlaceholder } from "@/components/phase-placeholder";

export default function BudgetPage() {
  return (
    <PhasePlaceholder
      activeHref="/budget"
      eyebrow="Plan mensual"
      title="Presupuesto"
      description="Aquí podrás comparar tus montos planeados y reales por categoría."
    />
  );
}
