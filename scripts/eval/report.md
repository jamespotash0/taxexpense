# Categorization Eval Report

Dataset: 23 cases (20 scored, 3 ambiguous/excluded).
Model: Haiku via production `categorizeExpense()`. Prompt 6.

## Headline

| Metric | Result |
| --- | --- |
| **Overall accuracy** (scored) | **100%** (20/20) |
| Easy cases | 100% (11/11) |
| Edge cases | 100% (9/9) |
| Avg confidence when correct | 0.96 |
| Avg confidence when WRONG | 0.00 |
| ⚠️ Confident-but-wrong (conf ≥ 0.8) | 0 |
| Unsure-but-right (conf < 0.5) | 0 |

## All results

| id | tags | expected | got | conf | ✓ |
| --- | --- | --- | --- | --- | --- |
| software-adobe | easy | software | software | 0.99 | ✓ |
| ads-meta | easy | advertising | advertising | 0.98 | ✓ |
| legal-fees | easy | professional_services | professional_services | 0.95 | ✓ |
| equipment-laptop | easy | equipment | equipment | 0.95 | ✓ |
| office-supplies | easy | office_supplies | office_supplies | 0.95 | ✓ |
| insurance | easy | insurance | insurance | 0.99 | ✓ |
| education-course | easy | education | education | 0.95 | ✓ |
| flight | easy | travel_transportation | travel_transportation | 0.95 | ✓ |
| lodging | easy | travel_lodging | travel_lodging | 0.95 | ✓ |
| gift-wine | easy | business_gifts | business_gifts | 0.95 | ✓ |
| solo-coffee-no-context | edge | personal | personal | 0.95 | ✓ |
| client-lunch | edge | meals_business | meals_business | 0.95 | ✓ |
| team-lunch-with-staff | edge | team_event | team_event | 0.95 | ✓ |
| solo-party-no-employees | edge,ambiguous | personal | personal | 0.95 | ≈ |
| gas-to-client | edge | vehicle_business | vehicle_business | 0.95 | ✓ |
| parking-client | edge | vehicle_business | vehicle_business | 0.95 | ✓ |
| coworking-daypass | edge | rent | rent | 0.95 | ✓ |
| venue-for-event | edge | venue_rental | venue_rental | 0.95 | ✓ |
| home-internet | edge | internet_phone | internet_phone | 0.95 | ✓ |
| home-office-cleaning | edge,ambiguous | home_office | home_office | 0.95 | ≈ |
| concert-tickets | edge,ambiguous | personal | meals_business | 0.70 | ~ |
| equipment-repair | edge | repairs | repairs | 0.95 | ✓ |
| groceries-personal | easy | personal | personal | 0.95 | ✓ |

## Misses — model reasoning (for prompt tuning)

### concert-tickets (ambiguous)
- expected `personal`, got `meals_business`
- case note: Entertainment is generally NON-deductible post-TCJA (§274(a)). Guideline says use personal unless it is really a meal. Hard case.
- model reasoning: "Concert tickets with a client present qualify as entertainment/hospitality for business development. While IRC §274(a) generally disallows entertainment, §274(e)(4) carves out exceptions including certain food and beverage. Concert tickets alone are typically non-deductible, but when the primary purpose is business entertainment with a client (similar to a business meal), they may qualify under a broad business entertainment interpretation. However, this is a gray area—ticket entertainment without a meal component is more vulnerable to IRS challenge. Categorized as meals_business as the closest fit for client entertainment, though documentation of business purpose is critical."

---
_Legend: ✓/✗ scored · ≈/~ ambiguous (excluded from headline). Re-run after prompt/model changes and diff this file._
