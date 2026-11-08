# Skill: Semi-Automated WhatsApp Outreach Assistant

This skill governs the conversational outreach dispatcher, message template engine, and queue sequencing for converting prospects discovered without websites into paying web clients.

## 1. Outreach Qualification Criteria

A lead qualifies for the automated outreach assistant queue when:
1. `phoneFormatted` is valid and begins with `+549`.
2. `hasWebsite` is `false` (highest conversion priority) or uses social media exclusively.
3. `status` is currently `discovered` or `enriched` (not yet contacted).

## 2. Dynamic Variable Engine

The template interpolation engine dynamically injects business context into the pitch:

| Variable | Source Property | Example Output |
| :--- | :--- | :--- |
| `{name}` | `lead.name` | `Gimnasio XXL` |
| `{city}` | `lead.city.split(',')[0]` | `Palermo` |
| `{rating}` | `lead.rating` | `4.5` |
| `{reviews}` | `lead.reviewsCount` | `410` |
| `{category}` | `lead.category` | `Gyms & Crossfit Centers` |
| `{demo}` | `lead.suggestedDemo` | `https://gym-web-demo.vercel.app` |

### Default High-Converting Pitch Template
```text
Hola {name}! Vi sus excelentes calificaciones en Google ({rating}★) en {city}. Noté que aún no tienen sitio web propio y les armé una propuesta interactiva de cómo quedaría su página web moderna para {category}: {demo} ¿Les gustaría que les comparta más detalles?
```

## 3. Dispatch & State Lifecycle

When the operator triggers "Open WhatsApp & Next Target":
1. Clean phone digits: strips leading `+`.
2. URL Encoding: pitch text encoded via `encodeURIComponent`.
3. WhatsApp Dispatch: opens `https://wa.me/{cleanPhone}?text={encodedPitch}` in a separate tab.
4. Database State Transition:
   - Sets `status` = `contacted`.
   - Records `contactedAt` = `new Date().toISOString()`.
5. Automatic Queue Step: advances the assistant index (`outreachIndex + 1`).

## 4. Anti-Ban & Reputation Safeguards

WhatsApp monitors outbound messages initiated toward unadded contacts:
- **Use Argentine SIM**: Always dispatch from a verified Argentine number (`+54 9 ...`). Foreign numbers (e.g. `+61`, `+1`) face near-instant spam flags from recipients.
- **Batch Cadence**: Limit dispatches to batches of 10 to 15 contacts per hour. Avoid rapid automated firing.
- **Personalized Framing**: Messages reference exact Google review counts and neighborhood details, avoiding automated bulk spam appearances.
