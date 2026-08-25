# News Layer Research

**Purpose:** determine a legitimate, free, currently-usable source of football news/context before writing any News Layer code — the same discipline already applied to Key Moments, nationality data, and the defensive-data enrichment. Every candidate below was checked live (real terms pages, real API responses, real feed content fetched during this investigation), not assumed from memory or prior training.

**Headline conclusion:** every general-purpose multi-publisher news option checked — three commercial news APIs and three major reputable RSS feeds — either explicitly forbids production/commercial use on its free tier, or requires a paid business licence for exactly the kind of redistribution a News Layer needs. **None were rejected on technical grounds; all were rejected on licensing grounds**, which is the same standard that excluded several candidates during the Key Moments and nationality investigations. Phase 1 is instead built on a source already fully within this project's existing legitimate data relationship — see §6.

---

## 1. Commercial News APIs

### NewsAPI.org
- **Coverage:** broad, includes Premier League football coverage.
- **Free tier ("Developer") limits:** 100 requests/day, results delayed 24 hours, CORS restricted to `localhost`.
- **Terms:** the Developer plan is explicitly documented as **for development only** — not permitted in staging or production. A paid Business plan (~$449/month at time of writing) is required for any live, public-facing use.
- **Verdict: Rejected.** This app is deployed and publicly accessible; the free tier's own terms exclude that use case outright, independent of technical quality.

### GNews
- **Coverage:** general news aggregation, includes sports.
- **Free tier limits:** 100 requests/day, up to 10 articles/request, 12-hour publication delay, 30 days of historical data.
- **Terms:** free tier is explicitly documented as for **non-commercial projects, development, and testing only**; detected commercial use results in account termination.
- **Verdict: Rejected.** Same pattern as NewsAPI — free access exists, but its terms exclude a live product.

### The Guardian Open Platform
- **Coverage:** excellent — the Guardian has strong Premier League football coverage, and this API was purpose-built for content reuse (unlike the RSS feeds below).
- **Free tier ("Developer key"):** 500 calls/day, full article text access, no credit card required.
- **Terms:** the Developer key is explicitly licensed for **non-commercial projects only**. A separate, paid Commercial key is required otherwise, issued case-by-case.
- **Verdict: Rejected for now**, but **worth revisiting as a real, budgeted future option** — this is the most above-board, purpose-built API of everything checked, and if a commercial licence is ever budgeted for, it's the strongest candidate for Phase 2+.

## 2. Reputable RSS Feeds

Checked whether feeds still resolve at all — several major outlets have quietly dropped RSS in recent years — then checked each publisher's actual stated terms for reuse, not just technical availability.

### BBC Sport (`feeds.bbci.co.uk/sport/football/premier-league/rss.xml`)
- **Technical check:** live, current, excellent quality. Fetched during this investigation and confirmed **genuinely current 2026/27 season content** (a same-day transfer story, correctly dated), with title, short description, canonical link, GUID, and a thumbnail image per item — exactly the fields a NewsArticle model would want, for free, with zero scraping.
- **Terms (fetched directly from `bbc.co.uk/usingthebbc/terms-of-use/`, section 15 "Metadata and RSS feeds"):**
  > **"For people":** you can add the BBC News RSS feed to your site "provided you don't change the feed or remove branding, and you credit us... putting the text and hyperlink in a prominent place nearby."
  > **"For business":** *"You'll need a licence to use our metadata... For business use of our RSS feeds you'll need to get our permission, and there may be a fee to pay."*
- **Verdict: Rejected without a paid licence.** BBC's own terms draw the line at personal vs. business use, not at how much content is shown — a correctly-attributed, link-driving, headline-only integration still counts as "business use" for a product, by their own explicit wording. This is the closest parallel in this whole research pass to the original Key Moments situation: technically excellent, freely fetchable, and explicitly not licensed for this use without payment.

### The Guardian (`theguardian.com/football/premierleague/rss`)
- **Technical check:** live, working, current Premier League content.
- **Terms:** the Guardian is a commercial publisher; absent an explicit personal-use carve-out (unlike BBC's), standard copyright and the "no implied licence for commercial aggregation" principle (§4) applies by default.
- **Verdict: Rejected** for the same reason as their API's free tier — no commercial redistribution right without a licence.

### Sky Sports (`skysports.com/rss/12040`)
- **Technical check:** live, working.
- **Terms:** no specific RSS reuse clause found in Sky's general terms and conditions; general copyright/ToS applies by default, which does not grant redistribution rights for a commercial product.
- **Verdict: Rejected** — same reasoning, absent explicit permission.

### General legal principle confirmed during this research
Multiple independent legal sources agree: **"an implied licence to use RSS-distributed content is limited to personal use through an RSS reader, with no implied licence covering commercial use by aggregators."** Offering a public RSS feed does not, by itself, grant a third-party product the right to redistribute headlines/excerpts/images commercially — that requires either an explicit personal-use carve-out (BBC has one; it excludes business use) or a paid licence. This is the standard this whole research pass was measured against.

## 3. Google News RSS

- **Technical check:** an unofficial endpoint (`news.google.com/rss/search?...`) still works when queried directly.
- **Terms:** Google has **no official, supported RSS product** for this — RSS support was deprecated and shut down in 2017; the current endpoint is undocumented, community-discovered, carries no service-level guarantee, and third-party proxying/reuse of it risks violating Google's general terms of service around automated/undocumented access.
- **Verdict: Rejected.** This is functionally identical to the FPL `region` field precedent from the nationality investigation and the several "reverse-engineered private API" rejections from Key Moments — technically fetchable, not a legitimate, documented, supported integration point.

## 4. Official Premier League Site

- `premierleague.com/news` redirects to a JavaScript-rendered `/en/news` page with no discoverable public RSS feed or documented news API at time of checking.
- **Verdict: Not currently usable** — no stable, documented integration point exists to evaluate terms against. Worth re-checking in future if the League ever publishes one.

## 5. Official Club Sites

- Spot-checked; most modern club sites (Arsenal, Chelsea, etc.) no longer expose a simple public RSS feed, and each club's own terms would need individual review even where one exists (20 clubs × individual legal review is not a proportionate Phase 1 investment).
- **Verdict: Not pursued in Phase 1** — plausible future source (a club's own statements about itself are the least legally fraught category of "news"), but not investigated exhaustively here given the stronger option found in §6.

## 6. What We Already Have: FPL's Own Player `news` Field — Selected for Phase 1

While auditing the raw FPL bootstrap payload (the exact endpoint this app has ingested from since its first commit), two previously-unused fields stood out:

```json
{
  "web_name": "Bruno G.",
  "news": "Thigh injury - 75% chance of playing",
  "news_added": "2026-08-20T17:00:08.846118Z",
  "status": "d",
  "chance_of_playing_next_round": 75
}
```

Checked live during this investigation: **119 of 612 current players have a non-empty, genuinely current `news` entry right now** — injuries ("Groin injury - Unknown return date"), suspensions ("Suspended until 19 Sep"), and confirmed transfers/loans ("Has joined Paris Saint-Germain permanently", "Has joined Bolton Wanderers on loan for the rest of the season"), each with a precise `news_added` timestamp for freshness.

**Why this clears the bar every other candidate failed:**
- **Zero new licensing question.** This is the same `bootstrap-static` endpoint `ingestPlayers.ts` already fetches and parses on every ingestion run. There is no new terms-of-service to evaluate — the existing relationship with FPL's public API, already relied on for every player/team/match/score in this app, already covers it.
- **Zero new network cost.** The `news`/`news_added` fields are already present in the exact payload already being fetched daily; this is pure additional parsing of data already in memory, not a new API call.
- **Genuinely current and well-timestamped**, unlike Google News RSS's lack of guarantees.
- **Player association is exact, not fuzzy.** Each entry is already keyed to a specific FPL player ID by construction — the "entity matching" problem (ambiguous names like "Palmer" or "United") that a general news feed would face simply does not exist for this source, because FPL itself is doing the association.

**What this is not:** it is not editorial journalism — no headlines, no article bodies, no images, no named publisher byline, no opinion or quotes. It answers "why might this player's situation matter right now" for injuries/suspensions/transfers specifically, not the fuller "what's being said about this team" vision the brief describes. That fuller vision remains blocked on licensing (§1–§3), not on data availability or technical feasibility.

## 7. Recommendation

**Phase 1 is built on FPL's player `news` field only.** This is a genuine, if narrower, foundation: real, current, zero-risk, exactly-associated player context, sourced from data already fully within this project's legitimate use.

**Multi-publisher editorial news (BBC/Guardian/Sky-style headlines) is explicitly deferred, not abandoned.** If the product later justifies the cost, the Guardian Open Platform's commercial tier is the strongest re-entry point identified here — purpose-built for exactly this kind of reuse, unlike the RSS feeds, which would need a bespoke BBC business licence negotiation instead. This is a budget/business decision, not a technical one, and is not something to build around speculatively without that decision being made explicitly.

**Category coverage this actually supports (from the brief's proposed taxonomy):** Injury, Suspension, Transfer, Selection/availability. **Not currently supported:** Match reporting, Manager quotes, Press conference coverage, Tactical/context commentary, General Premier League news — all of these require the editorial sources rejected above.
