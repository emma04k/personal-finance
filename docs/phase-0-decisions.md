# Phase 0 product decisions

These decisions define the bootstrap contract. They do not introduce authentication, financial records, or business calculations before their planned phases.

## Product glossary

- **Financial period:** one explicitly selected calendar month and ISO currency.
- **Net income:** all take-home income sources after payroll/tax deductions, not salary alone.
- **Expense:** consumption or required cash outflow that reduces available balance.
- **Savings allocation:** cash intentionally reserved for a goal; reported separately from consumption while still contributing to total cash outflow.
- **Debt payment:** a required debt outflow that may link to one expense transaction and must never be counted twice.
- **Planned amount:** an intention for a period; `null` means not supplied and zero means deliberately set to zero.
- **Actual amount:** a value derived from confirmed, dated transactions rather than a duplicated total.

## Initial defaults and access

- Spanish is the initial product language.
- COP and `America/Bogota` are onboarding proposals only. The user must explicitly confirm currency and timezone; the app must not infer currency from the workbook's `$` symbol.
- Phase 2 should use OIDC authentication to avoid owning passwords and recovery.
- The first UI is single-user and invite-only, while persistence must remain multi-user-safe through server-derived ownership.
- A debt account supplies its default required payment; a monthly period may explicitly override it.

## Mobile information hierarchy

1. Summary and empty-state guidance.
2. Monthly budget.
3. Central one-handed transaction capture.
4. Debt capacity.
5. Reports, categories, privacy, and settings under More.

Phone layouts use one column, bottom navigation, cards, safe-area insets, and a bottom sheet. Tablet layouts may use two columns. Desktop layouts use an adaptive sidebar and a bounded content region. Breakpoints are 700px and 960px, with 320px as the supported minimum viewport.

## Deferred work

Authentication, persistence models, financial calculations, transactions, workbook import, reports, and all AI integration remain outside Phase 0.
