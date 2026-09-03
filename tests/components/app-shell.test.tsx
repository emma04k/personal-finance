import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { AppShell } from "@/components/app-shell";

describe("AppShell", () => {
  it("presents an honest empty summary and five primary destinations", () => {
    render(<AppShell />);

    expect(
      screen.getByRole("heading", { name: "Tu dinero, con calma." }),
    ).toBeInTheDocument();
    expect(screen.getByText("Aún no hay un presupuesto activo.")).toBeInTheDocument();

    const navigation = screen.getByRole("navigation", {
      name: "Navegación principal",
    });
    expect(navigation).toHaveTextContent("Resumen");
    expect(navigation).toHaveTextContent("Presupuesto");
    expect(navigation).toHaveTextContent("Añadir");
    expect(navigation).toHaveTextContent("Deudas");
    expect(navigation).toHaveTextContent("Más");
  });

  it("opens and closes the quick transaction sheet", async () => {
    const user = userEvent.setup();
    render(<AppShell />);

    const [quickAddButton] = screen.getAllByRole("button", {
      name: "Añadir transacción",
    });
    await user.click(quickAddButton);

    const dialog = screen.getByRole("dialog", { name: "Nueva transacción" });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByLabelText("Monto")).toHaveAttribute("inputmode", "decimal");
    expect(
      screen.getByRole("button", { name: "Guardar transacción" }),
    ).toBeDisabled();
    expect(screen.getByText("Disponible en una fase posterior.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(dialog).not.toBeInTheDocument();
  });

  it("closes on Escape and restores focus to the exact invoking button", async () => {
    const user = userEvent.setup();
    render(<AppShell />);

    const quickAddButtons = screen.getAllByRole("button", {
      name: "Añadir transacción",
    });
    const invokingButton = quickAddButtons.at(-1)!;
    await user.click(invokingButton);

    expect(screen.getByLabelText("Monto")).toHaveFocus();
    await user.keyboard("{Escape}");

    expect(
      screen.queryByRole("dialog", { name: "Nueva transacción" }),
    ).not.toBeInTheDocument();
    expect(invokingButton).toHaveFocus();
  });

  it("traps forward and reverse Tab navigation inside the dialog", async () => {
    const user = userEvent.setup();
    render(<AppShell />);

    const quickAddButtons = screen.getAllByRole("button", {
      name: "Añadir transacción",
    });
    await user.click(quickAddButtons.at(-1)!);

    const amountInput = screen.getByLabelText("Monto");
    const closeButton = screen.getByRole("button", { name: "Cerrar" });
    expect(amountInput).toHaveFocus();

    await user.tab();
    expect(closeButton).toHaveFocus();
    await user.tab({ shift: true });
    expect(amountInput).toHaveFocus();
  });

  it("excludes the page background while the dialog is open", async () => {
    const user = userEvent.setup();
    render(<AppShell />);

    const quickAddButtons = screen.getAllByRole("button", {
      name: "Añadir transacción",
    });
    await user.click(quickAddButtons.at(-1)!);

    const main = screen.getByRole("main", { hidden: true });
    const excludedBackground = main.closest("[inert]");
    expect(excludedBackground).not.toBeNull();
    expect(excludedBackground).toHaveAttribute("aria-hidden", "true");
  });
});
