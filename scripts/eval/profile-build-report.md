# Business-Profile Builder Eval

Cases: 9. Each is a work description run through production `generateBusinessProfile()` (Sonnet).

## Headline

| Metric | Result |
| --- | --- |
| **Cases passing all checks** | **100%** (9/9) |
| sells_product correct | 100% |
| categories valid + non-empty | 100% |

## Checks per case

| id | pass | industry | cats valid | cat recall | syn recall | sells✓ | notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| realtor | ✅ | ✓ | ✓ | 100% | 50% | ✓ | ✓ |
| rideshare | ✅ | ✓ | ✓ | 100% | 100% | ✓ | ✓ |
| photographer | ✅ | ✓ | ✓ | 100% | 100% | ✓ | ✓ |
| sw-consultant | ✅ | ✓ | ✓ | 100% | 100% | ✓ | ✓ |
| personal-trainer | ✅ | ✓ | ✓ | 100% | 100% | ✓ | ✓ |
| barber | ✅ | ✓ | ✓ | 100% | 100% | ✓ | ✓ |
| etsy-maker | ✅ | ✓ | ✓ | 100% | 100% | ✓ | ✓ |
| food-truck | ✅ | ✓ | ✓ | 100% | 100% | ✓ | ✓ |
| vague | ✅ | ✓ | ✓ | 100% | 100% | ✓ | ✓ |

## Generated profiles (eyeball quality)

### realtor — "real estate agent"
- industry: real estate agent | sells_product: false
- common_categories: advertising, vehicle_business, professional_services, meals_business, education, software, business_gifts
- synonyms: MLS fees→professional_services, desk fee→professional_services, E&O insurance→insurance, errors and omissions→insurance, staging→advertising, yard sign→advertising, lockbox→equipment, closing gift→business_gifts, CE course→education, continuing education→education, Docusign→software, Zillow leads→advertising, open house supplies→office_supplies
- notes: Real estate agents spend heavily on advertising (listings, signs, lead gen) and vehicle use (client showings, property visits). Closing gifts to buyers or sellers are business_gifts. Desk fees and MLS dues go to professional_services unless clearly an insurance premium.

### rideshare — "I drive for Uber and Lyft"
- industry: rideshare driver | sells_product: false
- common_categories: vehicle_business, internet_phone, equipment, education, personal
- synonyms: gas→vehicle_business, fuel→vehicle_business, EV charging→vehicle_business, car wash→vehicle_business, oil change→repairs, tire rotation→repairs, car repair→repairs, phone mount→equipment, dash cam→equipment, phone plan→internet_phone, Uber fee→personal, Lyft fee→personal
- notes: The core deductible expense is vehicle use — gas, mileage, tolls, parking, and routine maintenance all relate to the car used for driving. Phone and accessories used to run the rideshare app qualify as business expenses. Platform service fees or commissions retained by Uber/Lyft are not separate expenses the driver pays out-of-pocket.

### photographer — "freelance wedding photographer"
- industry: freelance wedding photographer | sells_product: false
- common_categories: equipment, software, advertising, education, vehicle_business, meals_business, insurance
- synonyms: camera body→equipment, lens→equipment, flash/strobe→equipment, memory cards→office_supplies, camera bag→equipment, Lightroom→software, Capture One→software, gallery delivery platform→software, Pixieset→software, ShootProof→software, second shooter→professional_services, photo booth rental→equipment, styled shoot→advertising, The Knot listing→advertising, WeddingWire listing→advertising, workshop→education, E&O / liability insurance→insurance, gear insurance→insurance
- notes: This photographer travels to venues for shoots, so mileage and parking to client locations are vehicle_business. Large camera and lighting gear purchases are equipment and may qualify for accelerated depreciation. Marketing spend on wedding directories and styled shoots is advertising.

### sw-consultant — "independent software consultant"
- industry: independent software consultant | sells_product: false
- common_categories: software, internet_phone, home_office, equipment, education, professional_services, advertising
- synonyms: GitHub→software, AWS→software, cloud hosting→software, IDE license→software, JetBrains→software, domain registration→advertising, technical course→education, conference→education, laptop→equipment, monitor→equipment, accountant→professional_services
- notes: Most recurring expenses are SaaS tools, cloud services, and dev subscriptions — use software broadly for these. Home office is common since most work is done remotely; separate home utilities or internet from software carefully. Client meals or travel to client sites should only be categorized as strict-substantiation categories when a clear business contact or trip purpose is present.

### personal-trainer — "self-employed personal trainer"
- industry: personal trainer | sells_product: false
- common_categories: equipment, education, advertising, software, internet_phone, vehicle_business, insurance
- synonyms: certification→education, CECs→education, CPR cert→education, NASM→education, ACE→education, liability insurance→insurance, gym software→software, scheduling app→software, resistance bands→equipment, dumbbells→equipment, foam roller→equipment, protein samples→personal
- notes: This trainer likely travels to clients or a rented gym space, so vehicle mileage and venue/space rental are common. Continuing education and certifications are core professional expenses. Any supplements or nutrition products purchased for personal use should be flagged as personal unless clearly resold or used in client sessions.

### barber — "barber renting a booth at a shop"
- industry: barber (booth renter) | sells_product: false
- common_categories: rent, equipment, advertising, education, internet_phone
- synonyms: booth rent→rent, chair rent→rent, clippers→equipment, trimmers→equipment, shears→equipment, cape→office_supplies, barbicide→office_supplies, styling products→office_supplies, continuing education→education
- notes: Booth rent paid to the shop is the primary recurring deduction. Tools like clippers and trimmers are equipment; consumables like combs, capes, and disinfectants are office_supplies. Small retail product sales to clients would make sells_product true, but service-only barbers keep it false.

### etsy-maker — "I make and sell handmade jewelry on Etsy"
- industry: handmade jewelry maker / Etsy seller | sells_product: true
- common_categories: office_supplies, equipment, advertising, software, professional_services
- synonyms: Etsy fees→advertising, Etsy listing fee→advertising, Etsy ads→advertising, beads→office_supplies, wire→office_supplies, clasps→office_supplies, findings→office_supplies, jewelry tools→equipment, soldering kit→equipment, packaging→office_supplies, shipping supplies→office_supplies, photography backdrop→equipment, ring mandrel→equipment, Canva→software, PayPal fees→professional_services
- notes: Raw materials (beads, wire, findings, chain, stones) and packaging are office_supplies unless the purchase is a larger durable tool or machine, which is equipment. Etsy listing and transaction fees are advertising since they are platform costs that drive sales visibility. Shipping costs paid to carriers (USPS, UPS, etc.) are a cost of goods and should be flagged if no matching category fits — use office_supplies as the closest catch-all.

### food-truck — "I run a taco food truck"
- industry: food truck operator | sells_product: true
- common_categories: office_supplies, equipment, vehicle_business, advertising, insurance, repairs, professional_services
- synonyms: commissary→rent, commissary kitchen→rent, propane→vehicle_business, generator fuel→vehicle_business, truck repair→repairs, truck maintenance→repairs, POS system→software, Square→software, health permit→professional_services, food handler permit→professional_services, event permit→professional_services, catering event→meals_business, festival fee→advertising, packaging→office_supplies, napkins→office_supplies, to-go containers→office_supplies
- notes: Food and ingredient purchases for resale are cost of goods sold, not a standard deduction category — flag these separately. The food truck itself and major kitchen equipment likely qualify for §179 expensing under equipment. Commissary or shared kitchen rental for prep work should map to rent.

### vague — "consultant"
- industry: consultant | sells_product: false
- common_categories: software, professional_services, advertising, internet_phone, home_office, meals_business, travel_transportation
- synonyms: (none)
- notes: Description is generic; keep categories broad. Client meals and travel are common but require clear business context. Home office is likely if no dedicated outside workspace.

---
_Re-run after changing BUSINESS_PROFILE_BUILDER_PROMPT or the BusinessProfile shape, and diff this file._
