# Skill: Google Maps Live Data Extractor

The Google Maps scraper extracts real commercial establishments in Argentina without hallucinating or relying on plain LLM text generation.

## 1. Core Mechanics

Google Maps serves dynamic data feeds via its internal `/search?tbm=map...` endpoint.

1. **Initial Seed Request**:
   - URL: `https://www.google.com/maps/search/{category}+en+{city},+Argentina?hl=es`
   - Headers: Realistic browser User-Agent (`Mozilla/5.0...`) and European consent cookie:
     `Cookie: SOCS=CAISHAgBEhJnd3NfMjAyNDA0MTUtMF9SQzIaAmVzIAEaBgiA_LuuBg`
2. **Preload Link Discovery**:
   - Regex scan for: `<link href="(/search\?tbm=map[^"]+)" as="fetch"`
3. **Data Stream Execution**:
   - Request to `https://www.google.com{discovered_path}`.
   - Strip leading defense prefix `)]}'\n`.
   - Parse raw multidimensional JSON array.

## 2. Parsing Target Attributes in `data[64]`

The data entries representing real business listings reside in index `data[64]`. For each `item = entry[1]`:

| Attribute | Index Location | Verification / Transformation |
| :--- | :--- | :--- |
| **Business Name** | `item[11]` | Trim whitespace, discard empty names. |
| **Address** | `item[39] \|\| item[18] \|\| item[2].join(', ')` | Full street name, postal code, and neighborhood. |
| **Website URL** | `item[7][0]` | Scans for external URL. |
| **Has Website Flag** | Calculated Boolean | `false` if null OR if URL points to social media (`instagram.com`, `facebook.com`, `wa.me`, `linktr.ee`, `tiktok.com`). |
| **Google Place ID** | `item[78]` | Unique Google identifier (e.g. `ChIJ-9SCR3jKvJURvA0_lKj6Pok`). |
| **Phone Number** | `item[178][0][0]` | Raw string as entered in Google Maps profile. |
| **Rating** | `item[4][7]` | Number rounded to 1 decimal place. |
| **Reviews Count** | `item[4][8]` | Integer count of public Google reviews. |

## 3. Argentine Phone Normalization (`formatArgentinePhone`)

Local businesses in Argentina register phone numbers in diverse formats (e.g., `011 4833-4666`, `15 2329-2334`, `0351 424-5555`). WhatsApp requires the international E.164 mobile format:

1. Strip all non-digit characters (`\D`).
2. If already starting with `549`, prepend `+` (`+549...`).
3. If starting with `54` followed by area code, insert mobile digit `9` (`+549...`).
4. If starting with trunk code `0` or prefix `15`, strip them.
5. Prepend `+549` to the cleaned subscriber digits.

## 4. Direct Place Verification URL

Never construct a search query string for verification, as Google Maps may return "Partial matches". Always construct a direct place link using the exact `place_id`:

```
https://www.google.com/maps/place/?q=place_id:<PLACE_ID>
```
Clicking this link opens the verified business pin without search ambiguity.
