/**
 * SYNTHETIC labeled headline pairs for clustering evaluation.
 *
 * Every pair is invented and deliberately generic — fictional towns,
 * companies and match-ups, no real recent events or claims. Labels:
 *  - same_event: two outlets rewording the same story (should merge)
 *  - related_but_different_event: same topic/entity, different story (no merge)
 *  - completely_different: unrelated stories (no merge)
 */

export type PairLabel =
  | "same_event"
  | "related_but_different_event"
  | "completely_different";

export interface ClusterPair {
  a: string;
  b: string;
  label: PairLabel;
}

export const CLUSTER_PAIRS: ClusterPair[] = [
  // ── same_event: reworded headlines from different outlets ─────────────
  {
    a: "Federal Reserve holds benchmark interest rate steady after policy meeting",
    b: "Federal Reserve keeps benchmark interest rate unchanged after policy meeting",
    label: "same_event",
  },
  {
    a: "Bank of Canada cuts key interest rate by quarter point",
    b: "Bank of Canada lowers key interest rate a quarter point",
    label: "same_event",
  },
  {
    a: "Wildfire forces evacuation order for Cedar Valley as crews battle flames",
    b: "Crews battle flames as wildfire puts Cedar Valley under evacuation order",
    label: "same_event",
  },
  {
    a: "NASA delays crewed moon mission by one year citing spacecraft testing",
    b: "NASA pushes crewed moon mission back one year over spacecraft testing",
    label: "same_event",
  },
  {
    a: "Parliament passes sweeping housing bill after marathon overnight session",
    b: "Sweeping housing bill clears Parliament following marathon overnight session",
    label: "same_event",
  },
  {
    a: "Northlight Mobile unveils flagship smartphone with satellite messaging",
    b: "Northlight Mobile launches flagship smartphone featuring satellite messaging",
    label: "same_event",
  },
  {
    a: "Supreme Court agrees to hear landmark broadband privacy case",
    b: "Supreme Court will hear landmark broadband privacy case",
    label: "same_event",
  },
  {
    a: "Hurricane Delia makes landfall near Gulfport with damaging winds",
    b: "Hurricane Delia comes ashore near Gulfport bringing damaging winds",
    label: "same_event",
  },
  {
    a: "Maple Airlines pilots vote to strike over contract dispute",
    b: "Pilots at Maple Airlines vote to strike in contract dispute",
    label: "same_event",
  },
  {
    a: "Riverton Rangers win national championship in overtime thriller",
    b: "Riverton Rangers capture national championship after overtime thriller",
    label: "same_event",
  },
  {
    a: "Health regulators approve first once-weekly insulin injection",
    b: "Regulators approve first once-weekly insulin injection for diabetes",
    label: "same_event",
  },
  {
    a: "Massive power outage leaves Harborview region in the dark for hours",
    b: "Harborview region hit by massive power outage lasting hours",
    label: "same_event",
  },
  {
    a: "Senate approves bipartisan rail safety bill in late night vote",
    b: "Senate passes bipartisan rail safety bill in late night vote",
    label: "same_event",
  },
  {
    a: "Antarctic expedition discovers ancient fossil forest beneath ice sheet",
    b: "Ancient fossil forest discovered beneath Antarctic ice sheet by expedition",
    label: "same_event",
  },
  {
    a: "Grandview Studios announces merger with streaming service Brightcast",
    b: "Grandview Studios to merge with streaming service Brightcast",
    label: "same_event",
  },
  {
    a: "Union workers ratify new contract at Lakeshore Motors assembly plant",
    b: "Lakeshore Motors workers ratify new contract at assembly plant",
    label: "same_event",
  },
  {
    a: "Earthquake shakes Pineville region but no major damage reported",
    b: "No major damage reported after earthquake shakes Pineville region",
    label: "same_event",
  },
  {
    a: "City council approves downtown transit expansion plan after long debate",
    b: "Downtown transit expansion plan approved by city council after long debate",
    label: "same_event",
  },

  // ── related_but_different_event: same topic, different story ──────────
  {
    a: "Federal Reserve announces new framework for annual bank stress tests",
    b: "Federal Reserve chair testifies before lawmakers on housing costs",
    label: "related_but_different_event",
  },
  {
    a: "Bank of Canada warns household debt remains top financial risk",
    b: "Bank of Canada appoints new deputy governor for financial stability",
    label: "related_but_different_event",
  },
  {
    a: "NASA selects landing site for robotic Mars sample mission",
    b: "NASA awards contract for next generation space station module",
    label: "related_but_different_event",
  },
  {
    a: "Wildfire smoke prompts air quality advisory across northern counties",
    b: "Wildfire season budget doubled as province hires more crews",
    label: "related_but_different_event",
  },
  {
    a: "Supreme Court declines to review state ballot design dispute",
    b: "Supreme Court sets spring arguments for major antitrust appeal",
    label: "related_but_different_event",
  },
  {
    a: "Maple Airlines adds new routes to three coastal cities",
    b: "Maple Airlines orders twenty regional jets to renew fleet",
    label: "related_but_different_event",
  },
  {
    a: "Riverton Rangers sign veteran goaltender to two year deal",
    b: "Riverton Rangers break ground on new practice arena",
    label: "related_but_different_event",
  },
  {
    a: "Northlight Mobile opens new chip design lab in Waterloo",
    b: "Northlight Mobile recalls charging adapters over overheating reports",
    label: "related_but_different_event",
  },
  {
    a: "Senate committee advances water infrastructure funding package",
    b: "Senate leaders spar over timeline for budget negotiations",
    label: "related_but_different_event",
  },
  {
    a: "New study links urban tree cover to cooler summer nights",
    b: "New study maps urban flood risk under heavier rainstorms",
    label: "related_but_different_event",
  },
  {
    a: "Lakeshore Motors posts record quarterly deliveries of electric vans",
    b: "Lakeshore Motors recalls pickup trucks over brake software flaw",
    label: "related_but_different_event",
  },
  {
    a: "Hurricane season forecast calls for above average storm activity",
    b: "Hurricane preparedness drills expand along the gulf coast",
    label: "related_but_different_event",
  },

  // ── completely_different: unrelated stories ───────────────────────────
  {
    a: "Federal Reserve holds benchmark interest rate steady after policy meeting",
    b: "Riverton Rangers win national championship in overtime thriller",
    label: "completely_different",
  },
  {
    a: "Wildfire forces evacuation order for Cedar Valley as crews battle flames",
    b: "Grandview Studios announces merger with streaming service Brightcast",
    label: "completely_different",
  },
  {
    a: "NASA delays crewed moon mission by one year citing spacecraft testing",
    b: "Maple Airlines pilots vote to strike over contract dispute",
    label: "completely_different",
  },
  {
    a: "Supreme Court agrees to hear landmark broadband privacy case",
    b: "Health regulators approve first once-weekly insulin injection",
    label: "completely_different",
  },
  {
    a: "Senate approves bipartisan rail safety bill in late night vote",
    b: "Antarctic expedition discovers ancient fossil forest beneath ice sheet",
    label: "completely_different",
  },
  {
    a: "Hurricane Delia makes landfall near Gulfport with damaging winds",
    b: "Northlight Mobile unveils flagship smartphone with satellite messaging",
    label: "completely_different",
  },
  {
    a: "Union workers ratify new contract at Lakeshore Motors assembly plant",
    b: "New study links urban tree cover to cooler summer nights",
    label: "completely_different",
  },
  {
    a: "City council approves downtown transit expansion plan after long debate",
    b: "Earthquake shakes Pineville region but no major damage reported",
    label: "completely_different",
  },
  {
    a: "Bank of Canada cuts key interest rate by quarter point",
    b: "Wildfire smoke prompts air quality advisory across northern counties",
    label: "completely_different",
  },
  {
    a: "Massive power outage leaves Harborview region in the dark for hours",
    b: "Supreme Court sets spring arguments for major antitrust appeal",
    label: "completely_different",
  },
  {
    a: "Parliament passes sweeping housing bill after marathon overnight session",
    b: "NASA selects landing site for robotic Mars sample mission",
    label: "completely_different",
  },
  {
    a: "Riverton Rangers sign veteran goaltender to two year deal",
    b: "Federal Reserve announces new framework for annual bank stress tests",
    label: "completely_different",
  },
  {
    a: "Maple Airlines orders twenty regional jets to renew fleet",
    b: "New study maps urban flood risk under heavier rainstorms",
    label: "completely_different",
  },
  {
    a: "Grandview Studios announces merger with streaming service Brightcast",
    b: "Senate committee advances water infrastructure funding package",
    label: "completely_different",
  },
];
