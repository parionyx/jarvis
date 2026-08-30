---
name: lead-discovery-apify
description: "Exhaustive Deep-Audit Google Maps B2B lead extraction with ALL individual customer reviews, reviewer details, owner responses, Q&As, and full attributes (Zero-Browser)."
version: 4.0.0
author: Parionyx Growth Team
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [lead-extraction, all-reviews, owner-responses, q-and-a, full-attributes, zero-browser]
---

# Skill: Full Exhaustive Google Maps Lead Extraction (All Reviews & All Details)

This skill equips Hunter to extract **100% of all available Google Business Profile (GBP) data**, including every single customer review, owner reply status, public Q&As, and full business amenities.

---

## 📊 Complete Exhaustive Metadata Schema Extracted:

### 1. 💬 All Individual Customer Reviews & Reputation Audit:
* `all_customer_reviews`: Array of individual review objects:
  * `reviewer_name`: Name of patient/customer
  * `stars`: Rating given (1 to 5 stars)
  * `review_text`: Full text feedback of the customer
  * `published_date`: Exact date/time of review
  * `owner_responded`: `True` / `False`
  * `owner_response_text`: Doctor/Owner's actual reply text (or `None` if ignored)
* `unanswered_reviews_count`: Total negative or positive reviews ignored by the business owner *(High-Converting Google Review Reputation Management Pitch!)*.
* `reviews_distribution`: Exact count of 5★, 4★, 3★, 2★, 1★ reviews.
* `popular_review_tags`: Keywords customers frequently mention (e.g. *"root canal"*, *"polite doctor"*, *"hygienic"*, *"waiting time"*).

### 2. ❓ Public Questions & Answers (Q&As):
* `questions_and_answers`: Public questions asked by customers on Google Maps and whether they were answered.

### 3. 🏢 Business Identity & Geolocation:
* `business_name`, `place_id`, `google_maps_url`.
* `address`, `locality`, and exact `geo_coordinates` (`lat`, `lng`).
* `primary_category` & `all_categories` (all sub-specialties).

### 4. 🛡️ Profile Verification & Operational Details:
* `is_gbp_claimed`: Verified/Claimed vs Unclaimed.
* `opening_hours`: Full Monday to Sunday timing schedule.
* `is_open_now`: Real-time open/closed status.
* `price_range`: Budget category ($, $$, $$$).

### 5. 📸 Visual Media Audit:
* `photos_count`: Total photos uploaded.
* `featured_image_url`: Main banner image.
* `sample_photos`: Direct URLs to profile pictures.

### 6. 🛋️ Full Amenities & Attributes:
* `full_amenities_and_attributes`: Accepted payment methods (UPI, Credit Cards), accessibility (Wheelchair), on-site parking, appointment policies, etc.

### 7. 🌐 Digital Conversion Gaps:
* `website` & `website_status`.
* `appointment_url`: Direct booking link or missing.
* `identified_audit_gaps`: Auto-compiled list of all detected flaws.
* `lead_score`: 1–10 Points.
* `recommended_pitch`: Tailored Parionyx package.

---

## 🛠️ How Hunter Executes Full Exhaustive Extraction:

```python
extract_google_maps_leads(
    search_niche="Dental Clinic",
    locality_or_sector="Sector 14 Gurgaon",
    max_results=10,
    max_reviews_per_lead=20,  # Extracts up to 20 individual reviews per business
    filter_missing_website_only=False
)
```
