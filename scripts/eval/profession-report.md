# Profession-Aware Categorization Eval (lift)

Cases: 8. Each run twice via production `categorizeExpense()` — baseline (no profile) vs. with the profession profile.

## Headline

| Metric | Result |
| --- | --- |
| Baseline accuracy (no profile) | 88% (7/8) |
| **With profile** | **100%** (8/8) |
| ✅ Fixed by the profile | 1 |
| ⚠️ Regressed by the profile | 0 |

## All results

| set | id | expected | baseline | with profile | lift |
| --- | --- | --- | --- | --- | --- |
| real estate agent | mls-dues | professional_services | professional_services ✓ | professional_services ✓ | = |
| real estate agent | desk-fee | professional_services | rent | professional_services ✓ | ✅ fixed |
| real estate agent | eo-insurance | insurance | insurance ✓ | insurance ✓ | = |
| real estate agent | staging | advertising | advertising ✓ | advertising ✓ | = |
| real estate agent | yard-signs | advertising | advertising ✓ | advertising ✓ | = |
| real estate agent | ce-license | education | education ✓ | education ✓ | = |
| real estate agent | closing-gift | business_gifts | business_gifts ✓ | business_gifts ✓ | = |
| real estate agent | showing-mileage | vehicle_business | vehicle_business ✓ | vehicle_business ✓ | = |

---
_Re-run after changing the profile shape, the builder prompt, or userContextLine, and diff this file._
