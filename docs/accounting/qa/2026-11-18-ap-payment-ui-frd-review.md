# AP Payment UI — FRD review (2026-11-18)

## Scope and source

- Reviewed the current AP Payment create/view/edit UI against [AP Payment FRD v2.16](https://drive.google.com/file/d/1pT3ApXgbpS736LP7IJ9LJ6AQiltcJHrB/view), document last modified 2026-11-15; source checked 2026-11-18.
- FRD references: §3.1 Header, §3.2 Settled Invoices, §3.3 Payment Methods, §3.4 WHT, §3.5 Other Expense, §4 Actions, §6.2 GL and §8 Guardrails.
- This is a focused UI audit, not confirmation of full FRD compliance or live Save → Reload → Post → GL completion.

## Current user decisions override older design assumptions

- Keep the current API flow: Payment currency derives from the allocated Invoice; explain this beside Currency. This pass does not enable independent/cross-currency payment selection.
- Save requires `Invoice total = Payment total + WHT total - Other Expense total`; Debit expense is positive and Credit expense is negative in the total.
- Invoice total, Payment and WHT cannot be negative; Payment may total zero. Amount inputs reject negative numbers; expense sign comes from Debit/Credit.
- WHT is optional. When present, require 1–3 valid services and non-empty Form/Condition; Form/Condition can change but cannot be cleared.
- Default WHT from Vendor when configured; Form falls back to PND.53 and Condition to `1: withholding`. Other Expense is optional.
- See [confirmed Save rules](../ap-payment-save-rules.md); these replace the FRD's earlier permission to save an unbalanced draft.

## UI fixes implemented in this working tree

| Area | Correction | Owning source |
| --- | --- | --- |
| WHT Condition | Bind the displayed value and change handler to the Payment form; preserve the selected value in the Save payload and display the loaded value. | `payment/ap-payment-detail.tsx`, `payment/ap-payment-form.ts` |
| WHT required fields | Mark Service/Form as required and replace the legacy “WHT profile” validation message with Service/Form/base/amount guidance. | `payment/ap-payment-wht.tsx`, `messages/{en,th}.json` |
| Expense dialog | Show Add or Edit according to whether the expense row already exists. | `payment/ap-payment-expenses.tsx` |
| Description | Place Description across the full header row; retain the 255-character limit. | `payment/ap-payment-header.tsx` |
| Base Disbursed | Show converted editable Payment amount and the persisted base amount in view mode. | `payment/ap-payment-header.tsx`, `payment/ap-payment-detail.tsx` |
| Manual FX input | Limit entry to five decimal places and validate a minimum of `0.00001`; blank retains automatic rate resolution. | `payment/ap-payment-header.tsx`, `payment/ap-payment-form.ts` |

Source paths above are under `routes/accounting/accounts-payable/` except `messages/`.

## Remaining UI work supported by existing data

- Payment Type Account/Cost Center/Dimensions badges still need to match FRD §3.3's master-derived accounting summary.
- Invoice selection still needs the original invoice FX rate, base amount and Total summary required by the settlement presentation.

## API or policy gaps — do not simulate completion in the UI

- Paid Date remains optional, lacks the FRD's complete date validation and is not stamped on Post as specified.
- Backend rate validation only requires a positive rate; the FRD minimum/five-decimal policy is not enforced consistently at the API boundary.
- Void reason is optional at the API boundary and does not enforce the FRD minimum of five characters.
- The contract has one bank/payment method, not the multi-bank allocation array in FRD §3.3.
- Editable payee name/tax ID/branch/address, WHT certificate number, expense dimensions, Source/Source Doc and selectable FX account are incomplete contract areas.
- A draft GL posting-preview endpoint is unavailable; a browser estimate must not be represented as an authoritative posting preview.
- FRD §3.4–3.5 labels WHT/expense amounts as THB, while the current API flow uses transaction amounts and conversion fields. Resolve this contract before relabelling inputs as THB.
- See [deferred API fields](../ap-api-deferred-fields.md) and [master integration QA](2026-11-18-ap-master-integration.md) for related rollout limitations.

## Verification status

- Read-only FRD/source comparison completed; the fixes above are implemented locally.
- Typecheck and scoped ESLint passed; four targeted test files passed (49 tests). A regression reproduced the missing loaded Condition before the fix, then verified the loaded value, user change and Save payload afterward.
- Vite production build passed with local runtime config; the existing large-chunk warning remains. React Doctor reported no issues in the changed files.
- Browser checks covered create/view/edit at 1366px and 390px, including Thai/English text, Currency guidance, WHT Condition changes, Add Expense title and the stored Base Amount. No document-level horizontal overflow was observed; wide detail tables retain their own scroll area.
- Restored the original locale setting and desktop viewport after inspection. No backend code or database data was changed in this UI review.
- No live Save/Reload/Post/GL success is claimed by this report; current environment behavior and posting evidence require separate verification.
