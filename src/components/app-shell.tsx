"use client";

import {
  Banknote,
  CircleDollarSign,
  LayoutDashboard,
  Menu,
  Plus,
  ReceiptText,
  WalletCards,
  X,
} from "lucide-react";
import Link from "next/link";
import type {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  ReactNode,
} from "react";
import { useEffect, useRef, useState } from "react";

const navigationItems = [
  { label: "Resumen", href: "/", icon: LayoutDashboard },
  { label: "Presupuesto", href: "/budget", icon: WalletCards },
  { label: "Deudas", href: "/debts", icon: Banknote },
  { label: "Más", href: "/more", icon: Menu },
] as const;

export function AppShell({
  activeHref = "/",
  children,
}: {
  activeHref?: string;
  children?: ReactNode;
}) {
  const [isQuickAddOpen, setQuickAddOpen] = useState(false);
  const amountInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const invokingButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isQuickAddOpen) {
      amountInputRef.current?.focus();
    } else {
      invokingButtonRef.current?.focus();
    }
  }, [isQuickAddOpen]);

  function openQuickAdd(event: ReactMouseEvent<HTMLButtonElement>) {
    invokingButtonRef.current = event.currentTarget;
    setQuickAddOpen(true);
  }

  function closeQuickAdd() {
    setQuickAddOpen(false);
  }

  function handleDialogKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeQuickAdd();
      return;
    }

    if (event.key !== "Tab" || !dialogRef.current) {
      return;
    }

    const focusableElements = Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
    const firstFocusableElement = focusableElements.at(0);
    const lastFocusableElement = focusableElements.at(-1);

    if (!firstFocusableElement || !lastFocusableElement) {
      event.preventDefault();
      dialogRef.current.focus();
      return;
    }

    if (event.shiftKey && document.activeElement === firstFocusableElement) {
      event.preventDefault();
      lastFocusableElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastFocusableElement) {
      event.preventDefault();
      firstFocusableElement.focus();
    }
  }

  return (
    <div className="app-shell">
      <div
        aria-hidden={isQuickAddOpen ? "true" : undefined}
        className="app-background"
        inert={isQuickAddOpen ? true : undefined}
      >
        <a className="skip-link" href="#main-content">
        Ir al contenido principal
      </a>

      <aside className="desktop-sidebar" aria-label="Navegación principal">
        <Brand />
        <nav className="desktop-nav">
          {navigationItems.map((item) => (
            <NavLink
              key={item.label}
              {...item}
              current={item.href === activeHref}
            />
          ))}
          <button className="desktop-add-button" onClick={openQuickAdd}>
            <Plus aria-hidden="true" size={20} />
            Añadir transacción
          </button>
        </nav>
      </aside>

      <div className="app-content">
        <header className="mobile-header">
          <Brand />
          <span className="phase-badge">Fase 0</span>
        </header>

        <main id="main-content" className="main-content" tabIndex={-1}>
          {children ?? <SummaryContent />}
        </main>
      </div>

      <nav className="bottom-nav" aria-label="Navegación principal">
        <NavLink {...navigationItems[0]} current={activeHref === "/"} />
        <NavLink
          {...navigationItems[1]}
          current={activeHref === navigationItems[1].href}
        />
        <button
          className="bottom-add-button"
          type="button"
          aria-label="Añadir transacción"
          onClick={openQuickAdd}
        >
          <span className="add-icon-wrap">
            <Plus aria-hidden="true" size={24} />
          </span>
          <span>Añadir</span>
        </button>
        <NavLink
          {...navigationItems[2]}
          current={activeHref === navigationItems[2].href}
        />
        <NavLink
          {...navigationItems[3]}
          current={activeHref === navigationItems[3].href}
        />
        </nav>
      </div>

      {isQuickAddOpen ? (
        <div className="sheet-backdrop" role="presentation">
          <section
            aria-labelledby="quick-add-title"
            aria-modal="true"
            className="quick-add-sheet"
            onKeyDown={handleDialogKeyDown}
            ref={dialogRef}
            role="dialog"
            tabIndex={-1}
          >
            <div className="sheet-handle" aria-hidden="true" />
            <div className="sheet-header">
              <div>
                <p className="eyebrow">Registro rápido</p>
                <h2 id="quick-add-title">Nueva transacción</h2>
              </div>
              <button
                aria-label="Cerrar"
                className="icon-button"
                onClick={closeQuickAdd}
                type="button"
              >
                <X aria-hidden="true" size={22} />
              </button>
            </div>

            <form className="quick-add-form">
              <label htmlFor="transaction-amount">Monto</label>
              <div className="amount-field">
                <span aria-hidden="true">$</span>
                <input
                  id="transaction-amount"
                  inputMode="decimal"
                  placeholder="0"
                  ref={amountInputRef}
                  type="text"
                />
              </div>

              <label htmlFor="transaction-category">Categoría</label>
              <select id="transaction-category" disabled defaultValue="">
                <option value="">Aún no hay categorías</option>
              </select>

              <p className="form-note" role="status">
                Disponible en una fase posterior.
              </p>
              <button className="primary-button" disabled type="submit">
                Guardar transacción
              </button>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function SummaryContent() {
  return (
    <>
      <section className="hero" aria-labelledby="summary-heading">
        <p className="eyebrow">Resumen mensual</p>
        <h1 id="summary-heading">Tu dinero, con calma.</h1>
        <p>
          Esta base está lista para construir tu presupuesto sin inventar cifras ni
          movimientos.
        </p>
      </section>

      <section className="summary-section" aria-labelledby="overview-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Estado actual</p>
            <h2 id="overview-heading">Vista general</h2>
          </div>
          <span className="period-chip">Sin periodo</span>
        </div>

        <div className="summary-grid">
          <SummaryCard
            icon={CircleDollarSign}
            label="Ingresos"
            description="Se mostrará cuando registres un periodo."
          />
          <SummaryCard
            icon={ReceiptText}
            label="Gastos"
            description="No hay transacciones registradas."
          />
          <SummaryCard
            icon={WalletCards}
            label="Saldo disponible"
            description="Se calculará con datos confirmados."
          />
        </div>
      </section>

      <section className="empty-state" aria-labelledby="empty-heading">
        <div className="empty-icon" aria-hidden="true">
          <WalletCards size={28} />
        </div>
        <div>
          <h2 id="empty-heading">Aún no hay un presupuesto activo.</h2>
          <p>
            La creación de periodos y el registro de movimientos se habilitarán en fases
            posteriores.
          </p>
        </div>
        <button disabled type="button">
          Crear presupuesto
        </button>
      </section>
    </>
  );
}

function Brand() {
  return (
    <div className="brand" aria-label="Presupuesto EDOG">
      <span className="brand-mark" aria-hidden="true">
        <WalletCards size={22} />
      </span>
      <span>
        <strong>Presupuesto</strong>
        <small>EDOG</small>
      </span>
    </div>
  );
}

function NavLink({
  current = false,
  href,
  icon: Icon,
  label,
}: (typeof navigationItems)[number] & { current?: boolean }) {
  return (
    <Link
      aria-current={current ? "page" : undefined}
      className="nav-link"
      href={href}
    >
      <Icon aria-hidden="true" size={22} />
      <span>{label}</span>
    </Link>
  );
}

function SummaryCard({
  description,
  icon: Icon,
  label,
}: {
  description: string;
  icon: typeof CircleDollarSign;
  label: string;
}) {
  return (
    <article className="summary-card">
      <div className="card-icon" aria-hidden="true">
        <Icon size={22} />
      </div>
      <p>{label}</p>
      <strong>Sin datos</strong>
      <small>{description}</small>
    </article>
  );
}
