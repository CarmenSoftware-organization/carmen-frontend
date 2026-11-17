# AR cheque and output VAT navigation

Source reviewed: [AR Dashboard Functional Requirement Document (FRD v1.1)](https://drive.google.com/file/d/11J6MOaJbEkgJ2ZFV1MMKge7mXD-mOHBX/view), approved 8 November 2026, and its [v1.1 mockup](https://drive.google.com/file/d/1UUgim5PvzkKrV3o8ixJbrzWpd857g0zv/view).

- FRD §1.2.1(6), §2 FT-ARD-10/11/12 and §7.4 place received-cheque management and Output VAT Due/Undue in the AR operational cockpit. GL is a posting/reversal integration, not the navigation owner.
- §1.2.2 excludes AP cheque printing; the AR preview therefore contains customer received cheques only, with On Hand / In Transit / Cleared / Bounced states.
- §3.1 W-04 and §10 TC-ARD-07 require the AR dashboard's Undue link to open the tax pipeline with the Undue filter selected.

Canonical pages are `/accounting/accounts-receivable/cheque-reconciliation` and `/accounting/accounts-receivable/output-tax`. Old `/accounting/cheque-reconciliation` and `/accounting/output-tax` redirect while retaining their query strings.

The catalog has no dedicated Cheque/Output VAT resource feature. These mock screens use the existing `accounting.ar` module feature; no new license key, seed, or BU assignment was introduced.

The pages and dashboard register shortcuts remain explicit mock previews. They do not clear bank transactions, void real AR receipts, reopen debt, post/reverse GL, or submit ภ.พ.30. The existing dashboard is not a complete real-time implementation of every FRD v1.1 KPI/workflow.

Browser verification: legacy GL URLs redirected to AR; the Output Tax redirect retained `taxPoint=undue`. Both pages rendered under the Accounts Receivable sidebar at 1366×768 and 390×844 without page overflow. The AR Dashboard's Output VAT - Undue action opened the AR tax pipeline with Undue selected; Prepare ภ.พ.30 sample was disabled for Undue. Cheque preview showed only customer receipt references (`RC-SAMPLE-*`) and the four AR statuses. These checks do not prove real banking/tax APIs, because the pages remain mock previews.
