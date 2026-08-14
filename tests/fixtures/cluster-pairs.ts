/**
 * SYNTHETIC labeled headline pairs for clustering evaluation.
 *
 * Every pair is invented and deliberately generic — fictional towns,
 * companies, teams and people, no real recent events or claims. The ONLY
 * exception is the missionary trio: the three real headlines quoted in the
 * audit as the live clustering failure, kept verbatim as the must-merge
 * acceptance case.
 *
 * Labels:
 *  - SAME_EVENT: two outlets rewording the same story (must merge)
 *  - RELATED_EVENT: same topic/entities, different story — follow-ups,
 *    other votes by the same politician, other matches by the same team
 *    (must NOT merge; these are the dangerous near-misses)
 *  - DIFFERENT_EVENT: unrelated stories (must NOT merge)
 *
 * The SAME_EVENT section is deliberately heavy on reworded coverage in the
 * NPR/BBC/CBS style: different verbs for the same act (released~freed),
 * different word order, attribution tails ("his group says"), morphological
 * variation (kidnap/kidnapped). A handful are intentionally hard (very low
 * surface overlap) and may sit outside the recall target — the eval asserts
 * aggregate precision/recall, not per-pair perfection.
 */

export type PairLabel = "SAME_EVENT" | "RELATED_EVENT" | "DIFFERENT_EVENT";

export interface ClusterPair {
  a: string;
  b: string;
  label: PairLabel;
  /** Acceptance cases the production rule must individually merge. */
  mustMerge?: boolean;
}

// The audit's live failure: one event, three rewordings, three clusters.
// All three pairwise combinations are MUST-MERGE acceptance cases.
export const MISSIONARY_TRIO = [
  "U.S. missionary who was kidnapped in Niger is released",
  "US missionary released following kidnap in Niger, Christian group says",
  "American missionary kidnapped in Niger in October is freed, his group says",
] as const;

/**
 * The FOUR verbatim member headlines of the live production split (audit
 * round 4): ABC named the missionary, BBC used "following kidnap", CBS used
 * "9 months ago … organization says". All four must cluster as ONE event —
 * including surviving the anti-chaining validation pass (the live failure
 * was BBC being evicted against an ABC lead despite matching NPR/CBS).
 */
export const MISSIONARY_QUAD = [
  "American missionary Kevin Rideout released after 9 months in captivity in Niger",
  "U.S. missionary who was kidnapped in Niger is released",
  "US missionary released following kidnap in Niger, Christian group says",
  "American missionary released after kidnapping 9 months ago in Niger, organization says",
] as const;

export const CLUSTER_PAIRS: ClusterPair[] = [
  // ════════════════════════════════════════════════════════════════════
  // SAME_EVENT — reworded coverage of one story
  // ════════════════════════════════════════════════════════════════════
  {
    a: MISSIONARY_TRIO[0],
    b: MISSIONARY_TRIO[1],
    label: "SAME_EVENT",
    mustMerge: true,
  },
  {
    a: MISSIONARY_TRIO[0],
    b: MISSIONARY_TRIO[2],
    label: "SAME_EVENT",
    mustMerge: true,
  },
  {
    a: MISSIONARY_TRIO[1],
    b: MISSIONARY_TRIO[2],
    label: "SAME_EVENT",
    mustMerge: true,
  },
  // Third-audit variant: ABC-style coverage NAMES the missionary while the
  // others don't — the named variant must still join the same event.
  {
    a: MISSIONARY_TRIO[0],
    b: "Kevin Rideout, American missionary held in Niger, released after months in captivity",
    label: "SAME_EVENT",
    mustMerge: true,
  },
  {
    a: MISSIONARY_TRIO[2],
    b: "Kevin Rideout, American missionary held in Niger, released after months in captivity",
    label: "SAME_EVENT",
    mustMerge: true,
  },
  // Named-person rewording pairs (the audit's failure class): rare full
  // names anchor the fingerprint even when the rest is fully reworded.
  {
    a: "Astronaut Lena Marquette returns to Earth after record station stay",
    b: "Record-setting spaceflight ends as Lena Marquette lands safely",
    label: "SAME_EVENT",
  },
  {
    a: "Filmmaker Aldous Renkin wins top prize at Averston festival",
    b: "Averston festival jury hands top honor to Aldous Renkin",
    label: "SAME_EVENT",
  },
  {
    a: "Missing hiker Tomas Grealish found alive after six days in Kestrel Range",
    b: "Tomas Grealish rescued alive following six-day search in Kestrel Range",
    label: "SAME_EVENT",
  },
  // …and the dangerous named-person near-misses: same rare person,
  // DIFFERENT events — the name alone must never force a merge.
  {
    a: "Astronaut Lena Marquette returns to Earth after record station stay",
    b: "Lena Marquette announces retirement from astronaut corps",
    label: "RELATED_EVENT",
  },
  {
    a: "Filmmaker Aldous Renkin wins top prize at Averston festival",
    b: "Aldous Renkin begins shooting new drama in Delverton",
    label: "RELATED_EVENT",
  },
  {
    a: "Federal Reserve holds benchmark interest rate steady after policy meeting",
    b: "Federal Reserve keeps benchmark interest rate unchanged after policy meeting",
    label: "SAME_EVENT",
  },
  {
    a: "Bank of Canada cuts key interest rate by quarter point",
    b: "Bank of Canada lowers key interest rate a quarter point",
    label: "SAME_EVENT",
  },
  {
    a: "Wildfire forces evacuation order for Cedar Valley as crews battle flames",
    b: "Crews battle flames as wildfire puts Cedar Valley under evacuation order",
    label: "SAME_EVENT",
  },
  {
    a: "NASA delays crewed moon mission by one year citing spacecraft testing",
    b: "NASA pushes crewed moon mission back one year over spacecraft testing",
    label: "SAME_EVENT",
  },
  {
    a: "Parliament passes sweeping housing bill after marathon overnight session",
    b: "Sweeping housing bill clears Parliament following marathon overnight session",
    label: "SAME_EVENT",
  },
  {
    a: "Northlight Mobile unveils flagship smartphone with satellite messaging",
    b: "Northlight Mobile launches flagship smartphone featuring satellite messaging",
    label: "SAME_EVENT",
  },
  {
    a: "Supreme Court agrees to hear landmark broadband privacy case",
    b: "Supreme Court will hear landmark broadband privacy case",
    label: "SAME_EVENT",
  },
  {
    a: "Hurricane Delia makes landfall near Gulfport with damaging winds",
    b: "Hurricane Delia comes ashore near Gulfport bringing damaging winds",
    label: "SAME_EVENT",
  },
  {
    a: "Maple Airlines pilots vote to strike over contract dispute",
    b: "Pilots at Maple Airlines vote to strike in contract dispute",
    label: "SAME_EVENT",
  },
  {
    a: "Riverton Rangers win national championship in overtime thriller",
    b: "Riverton Rangers capture national championship after overtime thriller",
    label: "SAME_EVENT",
  },
  {
    a: "Health regulators approve first once-weekly insulin injection",
    b: "Regulators approve first once-weekly insulin injection for diabetes",
    label: "SAME_EVENT",
  },
  {
    a: "Massive power outage leaves Harborview region in the dark for hours",
    b: "Harborview region hit by massive power outage lasting hours",
    label: "SAME_EVENT",
  },
  {
    a: "Senate approves bipartisan rail safety bill in late night vote",
    b: "Senate passes bipartisan rail safety bill in late night vote",
    label: "SAME_EVENT",
  },
  {
    a: "Antarctic expedition discovers ancient fossil forest beneath ice sheet",
    b: "Ancient fossil forest discovered beneath Antarctic ice sheet by expedition",
    label: "SAME_EVENT",
  },
  {
    a: "Grandview Studios announces merger with streaming service Brightcast",
    b: "Grandview Studios to merge with streaming service Brightcast",
    label: "SAME_EVENT",
  },
  {
    a: "Union workers ratify new contract at Lakeshore Motors assembly plant",
    b: "Lakeshore Motors workers ratify new contract at assembly plant",
    label: "SAME_EVENT",
  },
  {
    a: "Earthquake shakes Pineville region but no major damage reported",
    b: "No major damage reported after earthquake shakes Pineville region",
    label: "SAME_EVENT",
  },
  {
    a: "City council approves downtown transit expansion plan after long debate",
    b: "Downtown transit expansion plan approved by city council after long debate",
    label: "SAME_EVENT",
  },
  // ── crime & justice, reworded with synonym verbs ─────────────────────
  {
    a: "Former Crestfield mayor arrested on bribery charges, police say",
    b: "Police detain ex-mayor of Crestfield over bribery allegations",
    label: "SAME_EVENT",
  },
  {
    a: "Jury finds Delmont financier guilty of fraud in landmark trial",
    b: "Delmont financier convicted of fraud after landmark trial",
    label: "SAME_EVENT",
  },
  {
    a: "Police charge two men over Ashford jewelry heist",
    b: "Two suspects indicted in Ashford jewelry heist investigation",
    label: "SAME_EVENT",
  },
  {
    a: "Escaped inmate recaptured near Pinehurst after three day manhunt",
    b: "Manhunt ends as escaped Pinehurst inmate is captured",
    label: "SAME_EVENT",
  },
  {
    a: "Smuggling ring dismantled as agents seize record cocaine haul at Port Havenford",
    b: "Agents capture record cocaine shipment at Havenford port, breaking up smuggling ring",
    label: "SAME_EVENT",
  },
  {
    a: "Verdale police arrest suspect in string of museum thefts",
    b: "Suspect in Verdale museum thefts taken into custody",
    label: "SAME_EVENT",
  },
  {
    a: "Gunman shot by officers after standoff at Millbrook shopping plaza",
    b: "Police shoot armed man following standoff at Millbrook plaza",
    label: "SAME_EVENT",
  },
  {
    a: "Journalist detained in Korvia released after two weeks, employer says",
    b: "Authorities in Korvia free detained journalist after two weeks",
    label: "SAME_EVENT",
  },
  // ── disasters & accidents ────────────────────────────────────────────
  {
    a: "Magnitude 6.1 earthquake strikes off Corvani coast, buildings sway",
    b: "Strong quake rattles Corvani coast, swaying buildings in capital",
    label: "SAME_EVENT",
  },
  {
    a: "Floodwaters swamp downtown Eastvale after record rainfall",
    b: "Record rainfall leaves downtown Eastvale flooded",
    label: "SAME_EVENT",
  },
  {
    a: "Volcano erupts on Mount Saralos, ash cloud grounds flights",
    b: "Mount Saralos eruption sends ash cloud over region, halting flights",
    label: "SAME_EVENT",
  },
  {
    a: "Ferry capsizes off Balenor coast leaving dozens missing",
    b: "Dozens missing after ferry overturns near Balenor",
    label: "SAME_EVENT",
  },
  {
    a: "Tornado tears through Wexford County, flattening homes and barns",
    b: "Homes flattened as tornado rips across Wexford County",
    label: "SAME_EVENT",
  },
  {
    a: "Apartment fire in Norvale leaves twelve families displaced",
    b: "Twelve families displaced after fire sweeps Norvale apartment block",
    label: "SAME_EVENT",
  },
  {
    a: "Landslide buries mountain road near Tessin Pass, cutting off villages",
    b: "Villages cut off after landslide blocks road at Tessin Pass",
    label: "SAME_EVENT",
  },
  {
    a: "Bus and freight train collide near Ostrander crossing, injuring nine",
    b: "Nine hurt as bus collides with train at Ostrander rail crossing",
    label: "SAME_EVENT",
  },
  {
    a: "Explosion at Pellagrin chemical plant forces overnight evacuation",
    b: "Blast at chemical plant in Pellagrin prompts evacuation overnight",
    label: "SAME_EVENT",
  },
  {
    a: "Winter storm knocks out power to thousands across Merrow Valley",
    b: "Thousands lose power as winter storm sweeps Merrow Valley",
    label: "SAME_EVENT",
  },
  {
    a: "Landmark Grangeway theater destroyed in overnight blaze",
    b: "Overnight fire destroys landmark Grangeway theater",
    label: "SAME_EVENT",
  },
  {
    a: "Cargo ship runs aground near Port Delune, blocking shipping lane",
    b: "Shipping lane blocked after cargo vessel grounds off Port Delune",
    label: "SAME_EVENT",
  },
  {
    a: "Cyclone Merat leaves trail of destruction across Pellow Islands",
    b: "Pellow Islands count cost of destruction after Cyclone Merat tears through",
    label: "SAME_EVENT",
  },
  // ── politics & government ────────────────────────────────────────────
  {
    a: "Lawmakers approve emergency drought relief package for farmers",
    b: "Emergency drought relief for farmers clears legislature",
    label: "SAME_EVENT",
  },
  {
    a: "Prime Minister of Aldovia resigns amid coalition collapse",
    b: "Aldovia's prime minister quits as coalition falls apart",
    label: "SAME_EVENT",
  },
  {
    a: "Senator Marden announces bid for governor of Westrock",
    b: "Marden declares run for Westrock governor",
    label: "SAME_EVENT",
  },
  {
    a: "Parliament rejects proposal to lower voting age to sixteen",
    b: "Parliament blocks proposal to lower voting age to sixteen",
    label: "SAME_EVENT",
  },
  {
    a: "Mayor Ferrin wins re-election in Dorchester Bay landslide",
    b: "Ferrin secures second term as Dorchester Bay mayor in landslide victory",
    label: "SAME_EVENT",
  },
  {
    a: "City of Kelworth bans gas powered leaf blowers starting next spring",
    b: "Kelworth outlaws gas leaf blowers beginning in spring",
    label: "SAME_EVENT",
  },
  {
    a: "Governor signs sweeping data privacy law for Meridian State",
    b: "Meridian State governor enacts broad data privacy law",
    label: "SAME_EVENT",
  },
  {
    a: "Opposition leader Varga detained at border crossing, party says",
    b: "Party says opposition leader Varga held by border guards",
    label: "SAME_EVENT",
  },
  {
    a: "Feldmark voters back independence referendum by narrow margin",
    b: "Narrow majority backs independence in Feldmark referendum",
    label: "SAME_EVENT",
  },
  {
    a: "Election officials order recount in tight Averston mayoral race",
    b: "Recount ordered as Averston mayoral race remains razor thin",
    label: "SAME_EVENT",
  },
  {
    a: "Council votes to pedestrianize historic Braywick market square",
    b: "Historic market square in Braywick to go car free after council vote",
    label: "SAME_EVENT",
  },
  // ── world ────────────────────────────────────────────────────────────
  {
    a: "Aldovia and Bexland sign historic river sharing treaty",
    b: "Historic water pact between Aldovia and Bexland finalized",
    label: "SAME_EVENT",
  },
  {
    a: "UN warns famine risk rising in drought hit Karlend region",
    b: "Famine risk growing in Karlend as drought deepens, UN warns",
    label: "SAME_EVENT",
  },
  {
    a: "Peace talks between Dovria and Selkath collapse over border dispute",
    b: "Dovria Selkath border talks break down, deepening dispute",
    label: "SAME_EVENT",
  },
  // ── business & markets ───────────────────────────────────────────────
  {
    a: "Talvane Motors recalls 200,000 sedans over faulty brake sensor",
    b: "Faulty brake sensor prompts Talvane Motors to recall 200,000 cars",
    label: "SAME_EVENT",
  },
  {
    a: "Vexbridge Bank cuts one hundred jobs at trading desk",
    b: "Vexbridge Bank to slash trading desk jobs",
    label: "SAME_EVENT",
  },
  {
    a: "Shares of Orvatek plunge after profit warning",
    b: "Orvatek stock tumbles on profit warning",
    label: "SAME_EVENT",
  },
  {
    a: "Corliss Air raises fares as fuel costs climb",
    b: "Corliss Air hikes ticket prices on higher fuel costs",
    label: "SAME_EVENT",
  },
  {
    a: "Regulators fine Pellamy Insurance record sum over mis-sold policies",
    b: "Pellamy Insurance hit with record fine for mis-selling policies",
    label: "SAME_EVENT",
  },
  {
    a: "Grain giant Halverson to buy rival Northfield Mills in cash deal",
    b: "Halverson agrees cash takeover of rival Northfield Mills",
    label: "SAME_EVENT",
  },
  {
    a: "Dockworkers begin strike at Port Selvane over pay dispute",
    b: "Strike halts cargo at Port Selvane as dockworkers demand better pay",
    label: "SAME_EVENT",
  },
  {
    a: "Krellex Biotech shares surge after cancer drug clears final trial",
    b: "Krellex Biotech stock jumps as cancer drug passes last stage trial",
    label: "SAME_EVENT",
  },
  {
    a: "Currency of Zavland falls to record low against dollar",
    b: "Zavland currency slides to record low against the dollar",
    label: "SAME_EVENT",
  },
  {
    a: "Massive data center campus planned for former Quarry Bend mine site",
    b: "Former mine site at Quarry Bend to host massive data center campus",
    label: "SAME_EVENT",
  },
  // ── science & technology ─────────────────────────────────────────────
  {
    a: "Quantum startup Verilume unveils error corrected chip prototype",
    b: "Verilume debuts prototype chip with error correction",
    label: "SAME_EVENT",
  },
  {
    a: "Researchers discover coral reef thriving in deep waters off Meralon",
    b: "Vast healthy coral reef found in deep sea near Meralon, scientists report",
    label: "SAME_EVENT",
  },
  {
    a: "Astronomers spot rare double ring around distant star Kevrani 7",
    b: "Rare double ring around star Kevrani 7 reported by astronomers",
    label: "SAME_EVENT",
  },
  {
    a: "Solvane Health app breach exposes data of two million users",
    b: "Data breach at Solvane Health affects two million app users",
    label: "SAME_EVENT",
  },
  {
    a: "Carveth University team maps genome of rare alpine flower",
    b: "Genome of rare alpine flower sequenced by Carveth University researchers",
    label: "SAME_EVENT",
  },
  {
    a: "Archaeologists uncover Roman era mosaic beneath Calverstone vineyard",
    b: "Roman mosaic discovered under vineyard near Calverstone",
    label: "SAME_EVENT",
  },
  {
    a: "Historic drought reveals sunken village beneath Lake Merrin",
    b: "Receding Lake Merrin waters expose village submerged for decades",
    label: "SAME_EVENT",
  },
  // ── sports ───────────────────────────────────────────────────────────
  {
    a: "Halden Rovers snatch last minute win over Kerrick United",
    b: "Late goal gives Halden Rovers victory over Kerrick United",
    label: "SAME_EVENT",
  },
  {
    a: "Marla Deverin wins national marathon title in record time",
    b: "Deverin triumphs in national marathon with record time",
    label: "SAME_EVENT",
  },
  {
    a: "Coach Ellard fired by Brenton City after winless month",
    b: "Brenton City dismiss coach Ellard following winless run",
    label: "SAME_EVENT",
  },
  {
    a: "Starling Bay Chargers appoint Rosa Malen as first female head coach",
    b: "Rosa Malen hired as Starling Bay Chargers head coach",
    label: "SAME_EVENT",
  },
  {
    a: "Referee strike postpones opening round of Carlon football league",
    b: "Carlon league opening round delayed by referee walkout",
    label: "SAME_EVENT",
  },
  // ── health & environment ─────────────────────────────────────────────
  {
    a: "Health officials warn of contaminated spinach sold in Lorwick stores",
    b: "Contaminated spinach pulled from Lorwick shelves as officials issue warning",
    label: "SAME_EVENT",
  },
  {
    a: "Trial finds new Rensley Pharma migraine drug halves attack frequency",
    b: "New Rensley Pharma migraine drug cuts attacks in half, study finds",
    label: "SAME_EVENT",
  },
  {
    a: "Salmonella outbreak linked to Deleford egg farm sickens dozens",
    b: "Dozens sick in salmonella outbreak traced to egg farm in Deleford",
    label: "SAME_EVENT",
  },
  {
    a: "Scientists warn invasive lionfish spreading rapidly along Vestria coast",
    b: "Invasive lionfish expanding fast along coast of Vestria, researchers caution",
    label: "SAME_EVENT",
  },
  {
    a: "Grid operator warns of rolling blackouts as heat wave strains power supply",
    b: "Rolling blackouts possible during heat wave, grid operator cautions",
    label: "SAME_EVENT",
  },
  // ── local & misc ─────────────────────────────────────────────────────
  {
    a: "Drought forces Casperton to impose emergency water restrictions",
    b: "Casperton imposes emergency water limits as drought deepens",
    label: "SAME_EVENT",
  },
  {
    a: "Teachers in Foxdale end week long strike after reaching pay deal",
    b: "Foxdale teachers strike ends with agreement on pay",
    label: "SAME_EVENT",
  },
  {
    a: "Striking nurses at Camden Vale hospital reach tentative deal",
    b: "Tentative agreement reached in Camden Vale nurses strike",
    label: "SAME_EVENT",
  },
  {
    a: "Rare Renaissance painting stolen from Velmora gallery overnight",
    b: "Thieves steal Renaissance era painting from gallery in Velmora",
    label: "SAME_EVENT",
  },
  {
    a: "Missing hiker found alive after five days in Torvald Range",
    b: "Hiker missing for five days discovered alive in Torvald Range",
    label: "SAME_EVENT",
  },
  {
    a: "Power restored to Selbourne after crews repair failed substation",
    b: "Selbourne outage ends as substation repairs are completed",
    label: "SAME_EVENT",
  },
  {
    a: "Wexley Zoo celebrates birth of endangered snow leopard cub",
    b: "Endangered snow leopard cub born at Wexley Zoo",
    label: "SAME_EVENT",
  },
  {
    a: "Vandals topple century old statue in Ellsworth town square",
    b: "Century old statue toppled overnight in Ellsworth square",
    label: "SAME_EVENT",
  },
  {
    a: "Endangered condor chick hatches at Valcrest sanctuary, first in a decade",
    b: "First condor chick in a decade hatches at Valcrest bird sanctuary",
    label: "SAME_EVENT",
  },
  {
    a: "Storm damaged Pier Nine reopens to visitors after two year rebuild",
    b: "Pier Nine welcomes visitors again following two year storm repair",
    label: "SAME_EVENT",
  },
  {
    a: "Ransomware attack cripples Bellmore city services for third day",
    b: "Bellmore struggles to restore city services after ransomware attack",
    label: "SAME_EVENT",
  },
  {
    a: "Kestrel Airways grounds jets after cracked windshield scare",
    b: "Cracked windshield scare prompts Kestrel Airways to ground fleet",
    label: "SAME_EVENT",
  },

  // ════════════════════════════════════════════════════════════════════
  // RELATED_EVENT — same entities/topic, DIFFERENT story (must not merge)
  // ════════════════════════════════════════════════════════════════════
  {
    a: "Federal Reserve announces new framework for annual bank stress tests",
    b: "Federal Reserve chair testifies before lawmakers on housing costs",
    label: "RELATED_EVENT",
  },
  {
    a: "Bank of Canada warns household debt remains top financial risk",
    b: "Bank of Canada appoints new deputy governor for financial stability",
    label: "RELATED_EVENT",
  },
  {
    a: "NASA selects landing site for robotic Mars sample mission",
    b: "NASA awards contract for next generation space station module",
    label: "RELATED_EVENT",
  },
  {
    a: "Wildfire smoke prompts air quality advisory across northern counties",
    b: "Wildfire season budget doubled as province hires more crews",
    label: "RELATED_EVENT",
  },
  {
    a: "Supreme Court declines to review state ballot design dispute",
    b: "Supreme Court sets spring arguments for major antitrust appeal",
    label: "RELATED_EVENT",
  },
  {
    a: "Maple Airlines adds new routes to three coastal cities",
    b: "Maple Airlines orders twenty regional jets to renew fleet",
    label: "RELATED_EVENT",
  },
  {
    a: "Riverton Rangers sign veteran goaltender to two year deal",
    b: "Riverton Rangers break ground on new practice arena",
    label: "RELATED_EVENT",
  },
  {
    a: "Northlight Mobile opens new chip design lab in Waterloo",
    b: "Northlight Mobile recalls charging adapters over overheating reports",
    label: "RELATED_EVENT",
  },
  {
    a: "Senate committee advances water infrastructure funding package",
    b: "Senate leaders spar over timeline for budget negotiations",
    label: "RELATED_EVENT",
  },
  {
    a: "New study links urban tree cover to cooler summer nights",
    b: "New study maps urban flood risk under heavier rainstorms",
    label: "RELATED_EVENT",
  },
  {
    a: "Lakeshore Motors posts record quarterly deliveries of electric vans",
    b: "Lakeshore Motors recalls pickup trucks over brake software flaw",
    label: "RELATED_EVENT",
  },
  {
    a: "Hurricane season forecast calls for above average storm activity",
    b: "Hurricane preparedness drills expand along the gulf coast",
    label: "RELATED_EVENT",
  },
  // ── same team/politician, different event (the dangerous near-misses) ──
  {
    a: "Riverton Rangers beat Harbor City Falcons in season opener",
    b: "Riverton Rangers beat Lakeside Comets in overtime",
    label: "RELATED_EVENT",
  },
  {
    a: "Governor Hale vetoes school funding bill after weeks of debate",
    b: "Governor Hale vetoes housing construction bill",
    label: "RELATED_EVENT",
  },
  {
    a: "Governor Hale signs teacher pay raise into law",
    b: "Governor Hale vetoes school funding bill after weeks of debate",
    label: "RELATED_EVENT",
  },
  {
    a: "Senate confirms Delia Marsh as transport secretary",
    b: "Senate confirms Owen Petty as energy secretary",
    label: "RELATED_EVENT",
  },
  {
    a: "Magnitude 6.1 earthquake strikes off Corvani coast, buildings sway",
    b: "Magnitude 5.3 earthquake shakes inland Corvani province days after coastal quake",
    label: "RELATED_EVENT",
  },
  {
    a: "Supreme Court hears arguments in broadband privacy case",
    b: "Supreme Court declines to hear school funding appeal",
    label: "RELATED_EVENT",
  },
  {
    a: "Halden Rovers snatch last minute win over Kerrick United",
    b: "Halden Rovers sign striker from Wexley Town",
    label: "RELATED_EVENT",
  },
  {
    a: "Rosa Malen hired as Starling Bay Chargers head coach",
    b: "Starling Bay Chargers lose season opener under new coach",
    label: "RELATED_EVENT",
  },
  {
    a: "Marla Deverin wins national marathon title in record time",
    b: "Deverin announces retirement from competitive running",
    label: "RELATED_EVENT",
  },
  {
    a: "Coach Ellard fired by Brenton City after winless month",
    b: "Brenton City names interim coach after Ellard departure",
    label: "RELATED_EVENT",
  },
  {
    a: "Mayor Ferrin wins re-election in Dorchester Bay landslide",
    b: "Mayor Ferrin unveils budget plan for second term",
    label: "RELATED_EVENT",
  },
  // ── follow-ups: same story arc, different day/story ──────────────────
  {
    a: "Ferry capsizes off Balenor coast leaving dozens missing",
    b: "Search called off for passengers missing in Balenor ferry disaster",
    label: "RELATED_EVENT",
  },
  {
    a: "Jury finds Delmont financier guilty of fraud in landmark trial",
    b: "Delmont financier to appeal fraud conviction, lawyers say",
    label: "RELATED_EVENT",
  },
  {
    a: "Hurricane Delia makes landfall near Gulfport with damaging winds",
    b: "Gulfport begins cleanup week after Hurricane Delia",
    label: "RELATED_EVENT",
  },
  {
    a: "Cyclone Merat leaves trail of destruction across Pellow Islands",
    b: "Aid ships reach Pellow Islands week after Cyclone Merat",
    label: "RELATED_EVENT",
  },
  {
    a: "Aldovia and Bexland sign historic river sharing treaty",
    b: "Bexland opposition urges delay in ratifying river treaty with Aldovia",
    label: "RELATED_EVENT",
  },
  {
    a: "Salmonella outbreak linked to Deleford egg farm sickens dozens",
    b: "Deleford egg farm resumes sales after salmonella all clear",
    label: "RELATED_EVENT",
  },
  {
    a: "Police charge two men over Ashford jewelry heist",
    b: "Stolen Ashford jewels recovered from canal, police say",
    label: "RELATED_EVENT",
  },
  {
    a: "Feldmark voters back independence referendum by narrow margin",
    b: "Feldmark begins independence talks with mainland after referendum",
    label: "RELATED_EVENT",
  },
  {
    a: "Bellmore struggles to restore city services after ransomware attack",
    b: "Bellmore approves cybersecurity budget increase after attack",
    label: "RELATED_EVENT",
  },
  {
    a: "Volcano erupts on Mount Saralos, ash cloud grounds flights",
    b: "Flights resume as Mount Saralos ash cloud clears",
    label: "RELATED_EVENT",
  },
  {
    a: "Dockworkers begin strike at Port Selvane over pay dispute",
    b: "Port Selvane strike enters third week as talks stall",
    label: "RELATED_EVENT",
  },
  {
    a: "Winter storm knocks out power to thousands across Merrow Valley",
    b: "Merrow Valley schools closed for second day after winter storm",
    label: "RELATED_EVENT",
  },
  {
    a: "Archaeologists uncover Roman era mosaic beneath Calverstone vineyard",
    b: "Calverstone museum plans exhibit for newly found Roman mosaic",
    label: "RELATED_EVENT",
  },
  {
    a: "Health officials warn of contaminated spinach sold in Lorwick stores",
    b: "Lorwick grocers restock spinach as contamination warning lifted",
    label: "RELATED_EVENT",
  },
  {
    a: "Explosion at Pellagrin chemical plant forces overnight evacuation",
    b: "Pellagrin chemical plant fined over safety violations last year",
    label: "RELATED_EVENT",
  },
  {
    a: "Missing hiker found alive after five days in Torvald Range",
    b: "Torvald Range park adds emergency shelters after hiker rescues",
    label: "RELATED_EVENT",
  },
  {
    a: "Rare Renaissance painting stolen from Velmora gallery overnight",
    b: "Velmora gallery unveils new security wing years after theft",
    label: "RELATED_EVENT",
  },
  {
    a: "Election officials order recount in tight Averston mayoral race",
    b: "Averston mayor elect promises unity after bitter campaign",
    label: "RELATED_EVENT",
  },
  {
    a: "Council votes to pedestrianize historic Braywick market square",
    b: "Braywick traders protest pedestrian only market square plan",
    label: "RELATED_EVENT",
  },
  // ── same company/institution, different story ────────────────────────
  {
    a: "Krellex Biotech shares surge after cancer drug clears final trial",
    b: "Krellex Biotech opens new manufacturing plant in Doverton",
    label: "RELATED_EVENT",
  },
  {
    a: "Talvane Motors recalls 200,000 sedans over faulty brake sensor",
    b: "Talvane Motors unveils electric pickup at Doverton auto show",
    label: "RELATED_EVENT",
  },
  {
    a: "Northlight Mobile unveils flagship smartphone with satellite messaging",
    b: "Northlight Mobile unveils budget tablet at Harvale trade show",
    label: "RELATED_EVENT",
  },
  {
    a: "Verilume debuts prototype chip with error correction",
    b: "Verilume raises new funding round to scale chip production",
    label: "RELATED_EVENT",
  },
  {
    a: "Vexbridge Bank cuts one hundred jobs at trading desk",
    b: "Vexbridge Bank names new head of retail banking",
    label: "RELATED_EVENT",
  },
  {
    a: "Corliss Air hikes ticket prices on higher fuel costs",
    b: "Corliss Air adds direct flights to Pellow Islands",
    label: "RELATED_EVENT",
  },
  {
    a: "Grain giant Halverson to buy rival Northfield Mills in cash deal",
    b: "Regulators open review of Halverson bid for Northfield Mills",
    label: "RELATED_EVENT",
  },
  {
    a: "Currency of Zavland falls to record low against dollar",
    b: "Zavland central bank raises rates to defend currency",
    label: "RELATED_EVENT",
  },
  {
    a: "Zavland currency slides to record low against the dollar",
    b: "Zavland inflation hits double digits, deepening currency crisis",
    label: "RELATED_EVENT",
  },
  {
    a: "City of Kelworth bans gas powered leaf blowers starting next spring",
    b: "Kelworth considers ban on downtown car traffic",
    label: "RELATED_EVENT",
  },
  {
    a: "Teachers in Foxdale end week long strike after reaching pay deal",
    b: "Foxdale bus drivers begin strike over schedules",
    label: "RELATED_EVENT",
  },
  {
    a: "Wexley Zoo celebrates birth of endangered snow leopard cub",
    b: "Wexley Zoo breaks ground on expanded reptile house",
    label: "RELATED_EVENT",
  },
  {
    a: "Kestrel Airways grounds jets after cracked windshield scare",
    b: "Kestrel Airways posts loss as groundings drag on bookings",
    label: "RELATED_EVENT",
  },
  {
    a: "Trial finds new Rensley Pharma migraine drug halves attack frequency",
    b: "Rensley Pharma seeks approval to sell migraine drug over the counter",
    label: "RELATED_EVENT",
  },
  {
    a: "Endangered condor chick hatches at Valcrest sanctuary, first in a decade",
    b: "Valcrest sanctuary launches fundraising drive to expand aviary",
    label: "RELATED_EVENT",
  },
  {
    a: "Storm damaged Pier Nine reopens to visitors after two year rebuild",
    b: "City approves night market on Pier Nine boardwalk",
    label: "RELATED_EVENT",
  },

  // ════════════════════════════════════════════════════════════════════
  // DIFFERENT_EVENT — unrelated stories (must not merge)
  // ════════════════════════════════════════════════════════════════════
  {
    a: "Federal Reserve holds benchmark interest rate steady after policy meeting",
    b: "Riverton Rangers win national championship in overtime thriller",
    label: "DIFFERENT_EVENT",
  },
  {
    a: "Wildfire forces evacuation order for Cedar Valley as crews battle flames",
    b: "Grandview Studios announces merger with streaming service Brightcast",
    label: "DIFFERENT_EVENT",
  },
  {
    a: "NASA delays crewed moon mission by one year citing spacecraft testing",
    b: "Maple Airlines pilots vote to strike over contract dispute",
    label: "DIFFERENT_EVENT",
  },
  {
    a: "Supreme Court agrees to hear landmark broadband privacy case",
    b: "Health regulators approve first once-weekly insulin injection",
    label: "DIFFERENT_EVENT",
  },
  {
    a: "Senate approves bipartisan rail safety bill in late night vote",
    b: "Antarctic expedition discovers ancient fossil forest beneath ice sheet",
    label: "DIFFERENT_EVENT",
  },
  {
    a: "Hurricane Delia makes landfall near Gulfport with damaging winds",
    b: "Northlight Mobile unveils flagship smartphone with satellite messaging",
    label: "DIFFERENT_EVENT",
  },
  {
    a: "Union workers ratify new contract at Lakeshore Motors assembly plant",
    b: "New study links urban tree cover to cooler summer nights",
    label: "DIFFERENT_EVENT",
  },
  {
    a: "City council approves downtown transit expansion plan after long debate",
    b: "Earthquake shakes Pineville region but no major damage reported",
    label: "DIFFERENT_EVENT",
  },
  {
    a: "Bank of Canada cuts key interest rate by quarter point",
    b: "Wildfire smoke prompts air quality advisory across northern counties",
    label: "DIFFERENT_EVENT",
  },
  {
    a: "Massive power outage leaves Harborview region in the dark for hours",
    b: "Supreme Court sets spring arguments for major antitrust appeal",
    label: "DIFFERENT_EVENT",
  },
  {
    a: "Parliament passes sweeping housing bill after marathon overnight session",
    b: "NASA selects landing site for robotic Mars sample mission",
    label: "DIFFERENT_EVENT",
  },
  {
    a: "Riverton Rangers sign veteran goaltender to two year deal",
    b: "Federal Reserve announces new framework for annual bank stress tests",
    label: "DIFFERENT_EVENT",
  },
  {
    a: "Maple Airlines orders twenty regional jets to renew fleet",
    b: "New study maps urban flood risk under heavier rainstorms",
    label: "DIFFERENT_EVENT",
  },
  {
    a: "Grandview Studios announces merger with streaming service Brightcast",
    b: "Senate committee advances water infrastructure funding package",
    label: "DIFFERENT_EVENT",
  },
  {
    a: "Former Crestfield mayor arrested on bribery charges, police say",
    b: "Volcano erupts on Mount Saralos, ash cloud grounds flights",
    label: "DIFFERENT_EVENT",
  },
  {
    a: "Jury finds Delmont financier guilty of fraud in landmark trial",
    b: "Wexley Zoo celebrates birth of endangered snow leopard cub",
    label: "DIFFERENT_EVENT",
  },
  {
    a: "Magnitude 6.1 earthquake strikes off Corvani coast, buildings sway",
    b: "Krellex Biotech shares surge after cancer drug clears final trial",
    label: "DIFFERENT_EVENT",
  },
  {
    a: "Floodwaters swamp downtown Eastvale after record rainfall",
    b: "Senate confirms Delia Marsh as transport secretary",
    label: "DIFFERENT_EVENT",
  },
  {
    a: "Tornado tears through Wexford County, flattening homes and barns",
    b: "Verilume debuts prototype chip with error correction",
    label: "DIFFERENT_EVENT",
  },
  {
    a: "Prime Minister of Aldovia resigns amid coalition collapse",
    b: "Marla Deverin wins national marathon title in record time",
    label: "DIFFERENT_EVENT",
  },
  {
    a: "City of Kelworth bans gas powered leaf blowers starting next spring",
    b: "Ferry capsizes off Balenor coast leaving dozens missing",
    label: "DIFFERENT_EVENT",
  },
  {
    a: "Talvane Motors recalls 200,000 sedans over faulty brake sensor",
    b: "Missing hiker found alive after five days in Torvald Range",
    label: "DIFFERENT_EVENT",
  },
  {
    a: "Vexbridge Bank cuts one hundred jobs at trading desk",
    b: "Salmonella outbreak linked to Deleford egg farm sickens dozens",
    label: "DIFFERENT_EVENT",
  },
  {
    a: "Shares of Orvatek plunge after profit warning",
    b: "Vandals topple century old statue in Ellsworth town square",
    label: "DIFFERENT_EVENT",
  },
  {
    a: "Corliss Air hikes ticket prices on higher fuel costs",
    b: "Archaeologists uncover Roman era mosaic beneath Calverstone vineyard",
    label: "DIFFERENT_EVENT",
  },
  {
    a: "Regulators fine Pellamy Insurance record sum over mis-sold policies",
    b: "Halden Rovers snatch last minute win over Kerrick United",
    label: "DIFFERENT_EVENT",
  },
  {
    a: "Grain giant Halverson to buy rival Northfield Mills in cash deal",
    b: "Astronomers spot rare double ring around distant star Kevrani 7",
    label: "DIFFERENT_EVENT",
  },
  {
    a: "Dockworkers begin strike at Port Selvane over pay dispute",
    b: "Solvane Health app breach exposes data of two million users",
    label: "DIFFERENT_EVENT",
  },
  {
    a: "Quantum startup Verilume unveils error corrected chip prototype",
    b: "Cyclone Merat leaves trail of destruction across Pellow Islands",
    label: "DIFFERENT_EVENT",
  },
  {
    a: "Researchers discover coral reef thriving in deep waters off Meralon",
    b: "Coach Ellard fired by Brenton City after winless month",
    label: "DIFFERENT_EVENT",
  },
  {
    a: "Carveth University team maps genome of rare alpine flower",
    b: "Gunman shot by officers after standoff at Millbrook shopping plaza",
    label: "DIFFERENT_EVENT",
  },
  {
    a: "Rosa Malen hired as Starling Bay Chargers head coach",
    b: "UN warns famine risk rising in drought hit Karlend region",
    label: "DIFFERENT_EVENT",
  },
  {
    a: "Health officials warn of contaminated spinach sold in Lorwick stores",
    b: "Feldmark voters back independence referendum by narrow margin",
    label: "DIFFERENT_EVENT",
  },
  {
    a: "Trial finds new Rensley Pharma migraine drug halves attack frequency",
    b: "Bus and freight train collide near Ostrander crossing, injuring nine",
    label: "DIFFERENT_EVENT",
  },
  {
    a: "Aldovia and Bexland sign historic river sharing treaty",
    b: "Winter storm knocks out power to thousands across Merrow Valley",
    label: "DIFFERENT_EVENT",
  },
  {
    a: "Explosion at Pellagrin chemical plant forces overnight evacuation",
    b: "Mayor Ferrin wins re-election in Dorchester Bay landslide",
    label: "DIFFERENT_EVENT",
  },
  {
    a: "Kestrel Airways grounds jets after cracked windshield scare",
    b: "Endangered condor chick hatches at Valcrest sanctuary, first in a decade",
    label: "DIFFERENT_EVENT",
  },
  {
    a: "Rare Renaissance painting stolen from Velmora gallery overnight",
    b: "Grid operator warns of rolling blackouts as heat wave strains power supply",
    label: "DIFFERENT_EVENT",
  },
  {
    a: "Drought forces Casperton to impose emergency water restrictions",
    b: "Teachers in Foxdale end week long strike after reaching pay deal",
    label: "DIFFERENT_EVENT",
  },
  {
    a: "Council votes to pedestrianize historic Braywick market square",
    b: "Currency of Zavland falls to record low against dollar",
    label: "DIFFERENT_EVENT",
  },
  {
    a: "Cargo ship runs aground near Port Delune, blocking shipping lane",
    b: "Election officials order recount in tight Averston mayoral race",
    label: "DIFFERENT_EVENT",
  },
  {
    a: "Landmark Grangeway theater destroyed in overnight blaze",
    b: "Zavland central bank raises rates to defend currency",
    label: "DIFFERENT_EVENT",
  },
  {
    a: "Power restored to Selbourne after crews repair failed substation",
    b: "Police charge two men over Ashford jewelry heist",
    label: "DIFFERENT_EVENT",
  },
  {
    a: "Striking nurses at Camden Vale hospital reach tentative deal",
    b: "Astronomers spot rare double ring around distant star Kevrani 7",
    label: "DIFFERENT_EVENT",
  },
  {
    a: "Escaped inmate recaptured near Pinehurst after three day manhunt",
    b: "Historic drought reveals sunken village beneath Lake Merrin",
    label: "DIFFERENT_EVENT",
  },
  {
    a: "Smuggling ring dismantled as agents seize record cocaine haul at Port Havenford",
    b: "Referee strike postpones opening round of Carlon football league",
    label: "DIFFERENT_EVENT",
  },
  {
    a: "Verdale police arrest suspect in string of museum thefts",
    b: "Scientists warn invasive lionfish spreading rapidly along Vestria coast",
    label: "DIFFERENT_EVENT",
  },
  {
    a: "Journalist detained in Korvia released after two weeks, employer says",
    b: "Storm damaged Pier Nine reopens to visitors after two year rebuild",
    label: "DIFFERENT_EVENT",
  },
  {
    a: "Peace talks between Dovria and Selkath collapse over border dispute",
    b: "Krellex Biotech opens new manufacturing plant in Doverton",
    label: "DIFFERENT_EVENT",
  },
  {
    a: "Senator Marden announces bid for governor of Westrock",
    b: "Apartment fire in Norvale leaves twelve families displaced",
    label: "DIFFERENT_EVENT",
  },
  {
    a: "Governor signs sweeping data privacy law for Meridian State",
    b: "Ransomware attack cripples Bellmore city services for third day",
    label: "DIFFERENT_EVENT",
  },
  {
    a: "Landslide buries mountain road near Tessin Pass, cutting off villages",
    b: "Northlight Mobile unveils budget tablet at Harvale trade show",
    label: "DIFFERENT_EVENT",
  },
  {
    a: "Opposition leader Varga detained at border crossing, party says",
    b: "Wexley Zoo breaks ground on expanded reptile house",
    label: "DIFFERENT_EVENT",
  },
  {
    a: "Lawmakers approve emergency drought relief package for farmers",
    b: "Halden Rovers sign striker from Wexley Town",
    label: "DIFFERENT_EVENT",
  },
  {
    a: "Mayor Ferrin unveils budget plan for second term",
    b: "Invasive lionfish expanding fast along coast of Vestria, researchers caution",
    label: "DIFFERENT_EVENT",
  },
  {
    a: "Foxdale bus drivers begin strike over schedules",
    b: "Endangered snow leopard cub born at Wexley Zoo",
    label: "DIFFERENT_EVENT",
  },
  {
    a: "Recount ordered as Averston mayoral race remains razor thin",
    b: "Blast at chemical plant in Pellagrin prompts evacuation overnight",
    label: "DIFFERENT_EVENT",
  },
  {
    a: "New Rensley Pharma migraine drug cuts attacks in half, study finds",
    b: "Cargo ship runs aground near Port Delune, blocking shipping lane",
    label: "DIFFERENT_EVENT",
  },
  {
    a: "Aid ships reach Pellow Islands week after Cyclone Merat",
    b: "Vexbridge Bank names new head of retail banking",
    label: "DIFFERENT_EVENT",
  },
  {
    a: "Delmont financier to appeal fraud conviction, lawyers say",
    b: "Rolling blackouts possible during heat wave, grid operator cautions",
    label: "DIFFERENT_EVENT",
  },

  // ════════════════════════════════════════════════════════════════════
  // EXPANSION BATCH (audit round 4): 500-pair benchmark
  // SAME_EVENT — verb-synonym swaps, clause reordering, attribution tails,
  // one-sided named people, numerals vs number words, abbreviation variants
  // ════════════════════════════════════════════════════════════════════
  { a: "Quillbrook city council approves downtown transit tunnel", b: "Downtown transit tunnel gets green light from Quillbrook council", label: "SAME_EVENT" },
  { a: "Ferry capsizes off Port Delune, twelve rescued", b: "Twelve pulled from water after ferry overturns near Port Delune", label: "SAME_EVENT" },
  { a: "Kestrel Airways cancels hundreds of flights as crews strike", b: "Kestrel Airways walkout grounds hundreds of flights", label: "SAME_EVENT" },
  { a: "Ombria central bank raises key rate to cool inflation", b: "Key interest rate hiked in Ombria as inflation persists", label: "SAME_EVENT" },
  { a: "Landslide buries highway near Merrow Pass, no injuries reported", b: "Highway near Merrow Pass closed after landslide, everyone safe", label: "SAME_EVENT" },
  { a: "Nettleford teachers ratify new contract, ending strike", b: "Strike over as Nettleford teachers approve contract deal", label: "SAME_EVENT" },
  { a: "Pellagrin chemical plant fire forces overnight evacuation", b: "Residents evacuated overnight as fire burns at Pellagrin chemical plant", label: "SAME_EVENT" },
  { a: "Wexley Zoo announces birth of rare snow leopard cub", b: "Rare snow leopard cub born at Wexley Zoo, keepers say", label: "SAME_EVENT" },
  { a: "Court blocks Dunhollow pipeline expansion pending review", b: "Dunhollow pipeline expansion halted by court order", label: "SAME_EVENT" },
  { a: "Halden Rovers sign striker Dario Ventisi on three-year deal", b: "Dario Ventisi joins Halden Rovers through 2029", label: "SAME_EVENT" },
  { a: "Storm Pell knocks out power to 40,000 homes across Grelloway", b: "Tens of thousands lose electricity in Grelloway as Storm Pell hits", label: "SAME_EVENT" },
  { a: "Rensley Pharma recalls blood pressure drug over labeling error", b: "Blood pressure medication pulled by Rensley Pharma after labeling mistake", label: "SAME_EVENT" },
  { a: "Ashmere mayor Corin Vale announces re-election bid", b: "Corin Vale to seek second term as Ashmere mayor", label: "SAME_EVENT" },
  { a: "Miners freed after three days trapped underground at Bell Creek", b: "Bell Creek miners rescued following three-day ordeal underground", label: "SAME_EVENT" },
  { a: "Regulator fines Vexbridge Bank over misleading mortgage ads", b: "Vexbridge Bank penalized for misleading mortgage advertising", label: "SAME_EVENT" },
  { a: "Tornado tears through Jarrowfen farmland, destroying barns", b: "Jarrowfen farms count losses after tornado levels barns", label: "SAME_EVENT" },
  { a: "Novelist Ida Prenn wins Calder Prize for fiction", b: "Calder Prize for fiction goes to Ida Prenn", label: "SAME_EVENT" },
  { a: "Pellow Islands declare emergency as cyclone nears", b: "State of emergency declared in Pellow Islands ahead of cyclone", label: "SAME_EVENT" },
  { a: "Grain terminal explosion injures four at Port Averil", b: "Four hurt in blast at Port Averil grain terminal", label: "SAME_EVENT" },
  { a: "Ilverston hospital opens region's first stroke unit", b: "Region's first dedicated stroke unit opens at Ilverston hospital", label: "SAME_EVENT" },
  { a: "Rathmoor voters reject casino referendum by wide margin", b: "Casino plan defeated decisively in Rathmoor referendum", label: "SAME_EVENT" },
  { a: "Archaeologists uncover Bronze Age settlement near Tarn Hollow", b: "Bronze Age village discovered at dig near Tarn Hollow", label: "SAME_EVENT" },
  { a: "Kerrick United sack manager after winless month", b: "Kerrick United part ways with manager following winless run", label: "SAME_EVENT" },
  { a: "Data breach at Loomis Retail exposes customer records", b: "Loomis Retail says customer records exposed in data breach", label: "SAME_EVENT" },
  { a: "Larkspur symphony cancels season amid funding shortfall", b: "Funding crisis forces Larkspur symphony to scrap season", label: "SAME_EVENT" },
  { a: "Police arrest suspect in Vorley gallery art theft", b: "Suspect in custody over Vorley gallery theft", label: "SAME_EVENT" },
  { a: "Brantley Motors recalls 80,000 pickups over brake defect", b: "Brake defect prompts Brantley Motors recall of eighty thousand pickups", label: "SAME_EVENT" },
  { a: "Wildcat strike shuts Drossfield copper mine", b: "Drossfield copper mine idled by wildcat strike", label: "SAME_EVENT" },
  { a: "Flooding closes schools across Hobbenshire", b: "Hobbenshire schools shut as floodwaters rise", label: "SAME_EVENT" },
  { a: "Astronomers detect water vapor on distant exoplanet Veyra-4b", b: "Water vapor found in atmosphere of exoplanet Veyra-4b", label: "SAME_EVENT" },
  { a: "Fenwick Dairy plant to close, cutting 300 jobs", b: "300 jobs lost as Fenwick Dairy shuts processing plant", label: "SAME_EVENT" },
  { a: "Senator Mara Quill resigns over ethics probe", b: "Ethics investigation prompts resignation of Senator Mara Quill", label: "SAME_EVENT" },
  { a: "Oil spill contained near Gullwing Bay after tanker leak", b: "Crews contain Gullwing Bay oil spill from leaking tanker", label: "SAME_EVENT" },
  { a: "Wrenfield University freezes tuition for two years", b: "Two-year tuition freeze announced at Wrenfield University", label: "SAME_EVENT" },
  { a: "Cyclist Beno Farrell wins Tour of Vestria in final sprint", b: "Beno Farrell takes Tour of Vestria title with last-day sprint", label: "SAME_EVENT" },
  { a: "Measles outbreak grows to 40 cases in Harlow County", b: "Harlow County measles cases climb to forty", label: "SAME_EVENT" },
  { a: "Judge approves settlement in Oxcombe water contamination suit", b: "Oxcombe water contamination settlement cleared by judge", label: "SAME_EVENT" },
  { a: "Historic Bramwick mill destroyed in overnight blaze", b: "Overnight fire guts historic mill in Bramwick", label: "SAME_EVENT" },
  { a: "Delune Port workers ratify deal, avoiding shutdown", b: "Port of Delune shutdown averted as workers approve agreement", label: "SAME_EVENT" },
  { a: "Glass sculptor Renn Odlum's retrospective opens at Corvale Museum", b: "Corvale Museum opens retrospective of sculptor Renn Odlum", label: "SAME_EVENT" },
  { a: "Vestria lifts visa requirement for Pellow Islands travelers", b: "Pellow Islands travelers no longer need visas for Vestria", label: "SAME_EVENT" },
  { a: "Quake of magnitude 5.8 rattles coastal Skerritt, minor damage", b: "Minor damage after 5.8 magnitude earthquake shakes Skerritt coast", label: "SAME_EVENT" },
  { a: "Averston Knights retire number of longtime captain Jory Ashe", b: "Jory Ashe's jersey retired by Averston Knights", label: "SAME_EVENT" },
  { a: "Startup Lumenfold raises 40 million for battery recycling", b: "Battery recycler Lumenfold lands $40M funding round", label: "SAME_EVENT" },
  { a: "Bridge inspection closes Harrow Crossing for a week", b: "Harrow Crossing shut seven days for bridge inspection", label: "SAME_EVENT" },
  { a: "Kestwick council votes to ban single-use plastics", b: "Single-use plastics banned by Kestwick council vote", label: "SAME_EVENT" },
  { a: "Rare comet Vell-Tarrow visible this week across northern skies", b: "Northern skywatchers get rare view of comet Vell-Tarrow", label: "SAME_EVENT" },
  { a: "Vandermoor Steel furnace restart delayed by safety review", b: "Safety review pushes back restart of Vandermoor Steel furnace", label: "SAME_EVENT" },
  { a: "Champion swimmer Lira Vosk breaks national 200m record", b: "Lira Vosk sets new national mark in 200 meters", label: "SAME_EVENT" },
  { a: "Avian flu detected at second Jorrel Basin poultry farm", b: "Second poultry farm in Jorrel Basin hit by avian flu", label: "SAME_EVENT" },
  { a: "Marnholt opera house reopens after decade-long restoration", b: "Decade of restoration ends as Marnholt opera house reopens", label: "SAME_EVENT" },
  { a: "Fraud trial of Delmont financier Aro Kesh begins", b: "Aro Kesh fraud case opens in Delmont court", label: "SAME_EVENT" },
  { a: "Dunmarsh approves congestion charge for downtown drivers", b: "Downtown congestion charge passes in Dunmarsh", label: "SAME_EVENT" },
  { a: "Missing kayaker found safe on Lake Merrin islet", b: "Kayaker missing on Lake Merrin rescued unharmed from islet", label: "SAME_EVENT" },
  { a: "Vexbridge Bank names Petra Solis chief executive", b: "Petra Solis appointed CEO of Vexbridge Bank", label: "SAME_EVENT" },
  { a: "Heat wave shatters temperature records across Tessary", b: "Record temperatures fall as heat wave grips Tessary", label: "SAME_EVENT" },
  { a: "Faylen voters back new arena in narrow referendum", b: "Arena referendum passes narrowly in Faylen", label: "SAME_EVENT" },
  { a: "Researchers reverse hearing loss in mice using gene therapy", b: "Gene therapy restores hearing in deaf mice, study finds", label: "SAME_EVENT" },
  { a: "Airline Kestrel adds direct route between Averston and Pellow Islands", b: "New Kestrel flight links Averston with Pellow Islands nonstop", label: "SAME_EVENT" },
  { a: "Farmers market vendor fined over mislabeled organic produce", b: "Mislabeled organic produce brings fine for market vendor", label: "SAME_EVENT" },
  { a: "Two firefighters injured battling Tarn Hollow warehouse blaze", b: "Warehouse fire in Tarn Hollow leaves two firefighters hurt", label: "SAME_EVENT" },
  { a: "Ednam approves rent stabilization for older buildings", b: "Rent stabilization measure adopted in Ednam", label: "SAME_EVENT" },
  { a: "Chess prodigy Nils Ordan, 14, earns grandmaster title", b: "Fourteen-year-old Nils Ordan becomes grandmaster", label: "SAME_EVENT" },
  { a: "Power returns to Sablewick grid after substation repair", b: "Sablewick electricity restored following substation fix", label: "SAME_EVENT" },
  { a: "Vestria parliament ratifies fisheries treaty with Norwick", b: "Fisheries treaty with Norwick clears Vestria parliament", label: "SAME_EVENT" },
  { a: "Museum returns looted bronze statues to Pellow Islands", b: "Looted bronzes repatriated to Pellow Islands by museum", label: "SAME_EVENT" },
  { a: "Cresmoor transit strike ends with binding arbitration deal", b: "Binding arbitration ends transit walkout in Cresmoor", label: "SAME_EVENT" },
  { a: "Toxic algae bloom closes beaches along Gullwing Bay", b: "Gullwing Bay beaches shut as toxic algae spreads", label: "SAME_EVENT" },
  { a: "Actor Vessa Marn to lead revival of stage classic in Delverton", b: "Delverton stage revival casts Vessa Marn in lead role", label: "SAME_EVENT" },
  { a: "Pryorsfield food bank reports record demand amid rising prices", b: "Record demand strains Pryorsfield food bank as prices climb", label: "SAME_EVENT" },
  { a: "Wexcott approves budget with deep cuts to road maintenance", b: "Road maintenance slashed in newly passed Wexcott budget", label: "SAME_EVENT" },
  { a: "Endangered condor chick hatches in Rooksmere breeding program", b: "Rooksmere breeding program celebrates hatching of condor chick", label: "SAME_EVENT" },
  { a: "Polwick ferry fares to rise 8 percent in spring", b: "Spring fare increase of eight percent set for Polwick ferries", label: "SAME_EVENT" },
  { a: "Sinkhole swallows section of Cabrell street, no one hurt", b: "Cabrell street partially collapses into sinkhole without injuries", label: "SAME_EVENT" },
  { a: "Quorland bans smartphones in elementary classrooms", b: "Elementary classroom smartphone ban adopted in Quorland", label: "SAME_EVENT" },
  { a: "Marathoner Edda Kyle disqualified over course shortcut", b: "Edda Kyle stripped of marathon result for cutting course", label: "SAME_EVENT" },
  { a: "Solar farm approved on former Serpington landfill site", b: "Former landfill in Serpington to host newly approved solar farm", label: "SAME_EVENT" },
  { a: "Publisher Harrow Press files for bankruptcy protection", b: "Harrow Press seeks bankruptcy protection", label: "SAME_EVENT" },
  { a: "Whale stranded on Culverstone sandbar refloated by volunteers", b: "Volunteers refloat whale stuck on sandbar near Culverstone", label: "SAME_EVENT" },
  { a: "Veyholt curbs short-term rentals in historic district", b: "Short-term rental limits imposed in Veyholt historic district", label: "SAME_EVENT" },
  { a: "Lightning strike sparks fire at Kestrel Range lookout tower", b: "Kestrel Range lookout tower burns after lightning strike", label: "SAME_EVENT" },
  { a: "Delune fishermen protest quota cuts outside ministry", b: "Quota cuts draw fishermen's protest at Delune ministry", label: "SAME_EVENT" },
  { a: "Study links Ivermoss well water to elevated arsenic", b: "Elevated arsenic found in Ivermoss well water, study says", label: "SAME_EVENT" },
  { a: "Veteran anchor Tomas Breel signs off after 30 years", b: "Tomas Breel ends three-decade run as news anchor", label: "SAME_EVENT" },
  { a: "Ice storm strands hundreds of motorists on Route 9 near Tarnley", b: "Hundreds stuck overnight on Route 9 as ice storm hits Tarnley", label: "SAME_EVENT" },
  { a: "Elmsworth hospital nurses vote to authorize strike", b: "Strike authorization approved by nurses at Elmsworth hospital", label: "SAME_EVENT" },
  { a: "Rare orchid rediscovered in Tarn Hollow bog after 80 years", b: "Orchid thought lost for eighty years found again in Tarn Hollow", label: "SAME_EVENT" },
  { a: "Vandals damage centuries-old carvings at Merrow Pass site", b: "Centuries-old carvings defaced at Merrow Pass heritage site", label: "SAME_EVENT" },
  { a: "Yarrowdale approves free transit for riders under 18", b: "Under-18s to ride free on Yarrowdale transit after vote", label: "SAME_EVENT" },
  { a: "Retired teacher donates rare map collection to Harleth library", b: "Harleth library receives rare maps from retired teacher's collection", label: "SAME_EVENT" },
  { a: "Grid operator warns Ardenfell faces winter power shortfall", b: "Ardenfell could face electricity shortfall this winter, operator cautions", label: "SAME_EVENT" },
  { a: "Champion mare Silverquill retired to stud after injury", b: "Injury ends racing career of champion mare Silverquill", label: "SAME_EVENT" },
  { a: "Quenby startup unveils biodegradable packaging foam", b: "Biodegradable foam packaging debuts from Quenby startup", label: "SAME_EVENT" },
  { a: "Council scraps plan to fell century-old oaks on Bell Avenue", b: "Bell Avenue's century-old oaks spared as council drops felling plan", label: "SAME_EVENT" },
  { a: "Salmonella outbreak tied to Quithby sprout farm sickens 22", b: "Twenty-two ill in salmonella outbreak linked to Quithby sprouts", label: "SAME_EVENT" },
  { a: "Auction of shipwreck gold coins nets record 3 million", b: "Shipwreck gold coins fetch record three million at auction", label: "SAME_EVENT" },
  { a: "Averston Knights goalkeeper Piet Malloy suspended four games", b: "Four-game ban handed to Knights keeper Piet Malloy", label: "SAME_EVENT" },
  { a: "Wind farm off Gullwing Bay clears final environmental review", b: "Final environmental hurdle passed for Gullwing Bay wind farm", label: "SAME_EVENT" },
  { a: "Librarians digitize Vestria's oldest newspaper archive", b: "Vestria's oldest newspapers scanned in digitization project", label: "SAME_EVENT" },
  { a: "Bus depot roof collapses under snow in Zellcombe, none injured", b: "Snow load caves in Zellcombe bus depot roof without injuries", label: "SAME_EVENT" },
  { a: "Chef Omar Pell's Torvane bistro earns top culinary award", b: "Top culinary honor goes to Omar Pell's bistro in Torvane", label: "SAME_EVENT" },
  { a: "Pellow Islands sign undersea cable deal to boost internet", b: "Undersea cable agreement to speed Pellow Islands internet", label: "SAME_EVENT" },
  { a: "Counterfeit medicine ring broken up in Kelmsley raids", b: "Kelmsley raids dismantle counterfeit drug operation", label: "SAME_EVENT" },
  { a: "Historic lighthouse at Cape Averil opens to overnight guests", b: "Cape Averil lighthouse begins hosting overnight stays", label: "SAME_EVENT" },
  { a: "Youth orchestra from Selwick invited to Vestria festival", b: "Selwick youth orchestra earns invitation to festival in Vestria", label: "SAME_EVENT" },
  { a: "Drought forces Kembervale to tap emergency reservoir", b: "Emergency reservoir opened as drought strains Kembervale", label: "SAME_EVENT" },
  { a: "Referee shortage delays start of Foxdale youth league", b: "Foxdale youth league season pushed back amid referee shortage", label: "SAME_EVENT" },
  { a: "Ostenholm airport unveils expanded international terminal", b: "Expanded international terminal opens at Ostenholm airport", label: "SAME_EVENT" },
  { a: "Beekeepers report record honey harvest across Umberley", b: "Umberley hives yield record honey crop, beekeepers say", label: "SAME_EVENT" },
  { a: "Court orders Yarrick landlord to repay withheld deposits", b: "Yarrick landlord must return withheld deposits, court rules", label: "SAME_EVENT" },
  { a: "Comet dust samples returned by Melvicia space probe", b: "Melvicia probe brings comet dust back to Earth", label: "SAME_EVENT" },
  { a: "Night market pilot draws thousands to Sarleth waterfront", b: "Thousands attend first night market on Sarleth waterfront", label: "SAME_EVENT" },
  { a: "Ganlow bans gas leaf blowers starting next year", b: "Gas leaf blower ban to take effect in Ganlow next year", label: "SAME_EVENT" },
  { a: "Champion angler Rilla Voss loses title over rule breach", b: "Rule violation costs Rilla Voss her angling championship", label: "SAME_EVENT" },
  { a: "Mudslide severs rail link between Thornbay and Merrow Pass", b: "Rail service between Thornbay and Merrow Pass cut by mudslide", label: "SAME_EVENT" },
  { a: "Tindale shelter waives adoption fees amid overcrowding", b: "Overcrowded Tindale shelter drops pet adoption fees", label: "SAME_EVENT" },
  { a: "Textile mill conversion brings 200 apartments to Ulverdale", b: "Ulverdale mill redevelopment to add two hundred apartments", label: "SAME_EVENT" },
  { a: "Scientists map genome of blight-resistant Sorvale wheat", b: "Blight-resistant wheat genome sequenced by Sorvale scientists", label: "SAME_EVENT" },
  { a: "Storm surge floods Delune boardwalk businesses", b: "Delune boardwalk shops swamped by storm surge", label: "SAME_EVENT" },
  { a: "Retiring judge Hale Morrow reflects on 25 years on bench", b: "Judge Hale Morrow steps down after quarter century", label: "SAME_EVENT" },
  { a: "Vintage aircraft rally returns to Ellsmere airfield", b: "Ellsmere airfield hosts returning vintage aircraft rally", label: "SAME_EVENT" },
  { a: "Cheese festival sets attendance record in Tarn Hollow", b: "Record crowds pack Tarn Hollow cheese festival", label: "SAME_EVENT" },
  { a: "Fuel spill closes stretch of Harrow River to boaters", b: "Harrow River section shut to boats after fuel spill", label: "SAME_EVENT" },
  { a: "Winslade teen wins national spelling title on 19th round", b: "National spelling crown goes to Winslade teenager after 19 rounds", label: "SAME_EVENT" },
  { a: "Fennwich museum acquires long-lost Ferren seascape painting", b: "Long-missing Ferren seascape joins Fennwich museum collection", label: "SAME_EVENT" },
  { a: "Pothole damage claims triple after harsh Hexbury winter", b: "Hexbury sees threefold jump in pothole damage claims", label: "SAME_EVENT" },
  { a: "Youth coding camp expands to five Bryndor towns", b: "Five towns in Bryndor to host expanded youth coding camp", label: "SAME_EVENT" },

  // ── RELATED_EVENT — follow-ups, reactions, day-2 stories, same actors ──
  { a: "Quillbrook city council approves downtown transit tunnel", b: "Business owners brace for years of transit tunnel construction in Quillbrook", label: "RELATED_EVENT" },
  { a: "Ferry capsizes off Port Delune, twelve rescued", b: "Port Delune ferry operator faces safety inquiry after capsize", label: "RELATED_EVENT" },
  { a: "Kestrel Airways cancels hundreds of flights as crews strike", b: "Kestrel Airways and union resume talks after weekend walkout", label: "RELATED_EVENT" },
  { a: "Ombria central bank raises key rate to cool inflation", b: "Ombria homebuyers retreat as borrowing costs climb", label: "RELATED_EVENT" },
  { a: "Nettleford teachers ratify new contract, ending strike", b: "Nettleford schools plan catch-up classes after strike disruption", label: "RELATED_EVENT" },
  { a: "Pellagrin chemical plant fire forces overnight evacuation", b: "Pellagrin chemical plant cited twice before for safety lapses", label: "RELATED_EVENT" },
  { a: "Halden Rovers sign striker Dario Ventisi on three-year deal", b: "Dario Ventisi scores twice on Halden Rovers debut", label: "RELATED_EVENT" },
  { a: "Storm Pell knocks out power to 40,000 homes across Grelloway", b: "Grelloway utility defends storm response as outages linger", label: "RELATED_EVENT" },
  { a: "Rensley Pharma recalls blood pressure drug over labeling error", b: "Pharmacies field anxious calls after Rensley Pharma recall", label: "RELATED_EVENT" },
  { a: "Ashmere mayor Corin Vale announces re-election bid", b: "Councillor Ines Fell launches challenge to mayor Corin Vale", label: "RELATED_EVENT" },
  { a: "Miners freed after three days trapped underground at Bell Creek", b: "Bell Creek mine ordered to overhaul safety systems after collapse", label: "RELATED_EVENT" },
  { a: "Regulator fines Vexbridge Bank over misleading mortgage ads", b: "Vexbridge Bank appeals mortgage advertising penalty", label: "RELATED_EVENT" },
  { a: "Tornado tears through Jarrowfen farmland, destroying barns", b: "Volunteers arrive to help Jarrowfen farmers rebuild after tornado", label: "RELATED_EVENT" },
  { a: "Novelist Ida Prenn wins Calder Prize for fiction", b: "Ida Prenn announces new novel set in the Pellow Islands", label: "RELATED_EVENT" },
  { a: "Grain terminal explosion injures four at Port Averil", b: "Investigators probe dust buildup in Port Averil terminal blast", label: "RELATED_EVENT" },
  { a: "Rathmoor voters reject casino referendum by wide margin", b: "Casino backers weigh new Rathmoor proposal after defeat", label: "RELATED_EVENT" },
  { a: "Kerrick United sack manager after winless month", b: "Kerrick United name caretaker boss for rest of season", label: "RELATED_EVENT" },
  { a: "Data breach at Loomis Retail exposes customer records", b: "Loomis Retail offers credit monitoring to breach victims", label: "RELATED_EVENT" },
  { a: "Police arrest suspect in Vorley gallery art theft", b: "Recovered Vorley paintings back on display after theft", label: "RELATED_EVENT" },
  { a: "Brantley Motors recalls 80,000 pickups over brake defect", b: "Brantley Motors quarterly profit dented by recall costs", label: "RELATED_EVENT" },
  { a: "Flooding closes schools across Hobbenshire", b: "Hobbenshire weighs levee upgrades after repeated floods", label: "RELATED_EVENT" },
  { a: "Senator Mara Quill resigns over ethics probe", b: "Race begins for Senate seat vacated by Mara Quill", label: "RELATED_EVENT" },
  { a: "Oil spill contained near Gullwing Bay after tanker leak", b: "Gullwing Bay fishery assesses damage following tanker spill", label: "RELATED_EVENT" },
  { a: "Cyclist Beno Farrell wins Tour of Vestria in final sprint", b: "Beno Farrell targets world championship after Vestria triumph", label: "RELATED_EVENT" },
  { a: "Measles outbreak grows to 40 cases in Harlow County", b: "Harlow County opens walk-in vaccination clinics amid outbreak", label: "RELATED_EVENT" },
  { a: "Historic Bramwick mill destroyed in overnight blaze", b: "Bramwick debates rebuilding mill lost to fire", label: "RELATED_EVENT" },
  { a: "Vestria lifts visa requirement for Pellow Islands travelers", b: "Pellow Islands tourism bookings surge after visa change", label: "RELATED_EVENT" },
  { a: "Quake of magnitude 5.8 rattles coastal Skerritt, minor damage", b: "Skerritt reviews building codes after coastal earthquake", label: "RELATED_EVENT" },
  { a: "Startup Lumenfold raises 40 million for battery recycling", b: "Lumenfold breaks ground on first battery recycling plant", label: "RELATED_EVENT" },
  { a: "Kestwick council votes to ban single-use plastics", b: "Kestwick cafes scramble for alternatives as plastics ban nears", label: "RELATED_EVENT" },
  { a: "Vandermoor Steel furnace restart delayed by safety review", b: "Vandermoor Steel workers face extended layoffs during furnace delay", label: "RELATED_EVENT" },
  { a: "Champion swimmer Lira Vosk breaks national 200m record", b: "Lira Vosk named athlete of the year by national federation", label: "RELATED_EVENT" },
  { a: "Avian flu detected at second Jorrel Basin poultry farm", b: "Egg prices tick up as avian flu culls hit Jorrel Basin supply", label: "RELATED_EVENT" },
  { a: "Fraud trial of Delmont financier Aro Kesh begins", b: "Key witness testifies in Aro Kesh fraud trial", label: "RELATED_EVENT" },
  { a: "Dunmarsh approves congestion charge for downtown drivers", b: "Dunmarsh retailers report quieter streets after congestion charge", label: "RELATED_EVENT" },
  { a: "Vexbridge Bank names Petra Solis chief executive", b: "Petra Solis outlines digital overhaul in first address as CEO", label: "RELATED_EVENT" },
  { a: "Heat wave shatters temperature records across Tessary", b: "Tessary cooling centers see record visits during heat emergency", label: "RELATED_EVENT" },
  { a: "Researchers reverse hearing loss in mice using gene therapy", b: "Hearing-loss gene therapy moves toward first human trial", label: "RELATED_EVENT" },
  { a: "Two firefighters injured battling Tarn Hollow warehouse blaze", b: "Injured Tarn Hollow firefighters released from hospital", label: "RELATED_EVENT" },
  { a: "Chess prodigy Nils Ordan, 14, earns grandmaster title", b: "Nils Ordan invited to elite invitational after grandmaster milestone", label: "RELATED_EVENT" },
  { a: "Vestria parliament ratifies fisheries treaty with Norwick", b: "Norwick trawler fleet adapts to new treaty quotas", label: "RELATED_EVENT" },
  { a: "Museum returns looted bronze statues to Pellow Islands", b: "Pellow Islands unveil gallery for repatriated bronzes", label: "RELATED_EVENT" },
  { a: "Toxic algae bloom closes beaches along Gullwing Bay", b: "Scientists trace Gullwing Bay algae bloom to farm runoff", label: "RELATED_EVENT" },
  { a: "Pryorsfield food bank reports record demand amid rising prices", b: "Pryorsfield council doubles emergency grant to strained food bank", label: "RELATED_EVENT" },
  { a: "Endangered condor chick hatches in Rooksmere breeding program", b: "Rooksmere program plans first condor release into the wild", label: "RELATED_EVENT" },
  { a: "Sinkhole swallows section of Cabrell street, no one hurt", b: "Aging water main suspected in Cabrell sinkhole collapse", label: "RELATED_EVENT" },
  { a: "Marathoner Edda Kyle disqualified over course shortcut", b: "Edda Kyle apologizes and vows return after disqualification", label: "RELATED_EVENT" },
  { a: "Publisher Harrow Press files for bankruptcy protection", b: "Authors seek rights back as Harrow Press restructures", label: "RELATED_EVENT" },
  { a: "Veyholt curbs short-term rentals in historic district", b: "Rental hosts sue Veyholt over historic district restrictions", label: "RELATED_EVENT" },
  { a: "Study links Ivermoss well water to elevated arsenic", b: "Ivermoss to fund filtration rebates after arsenic findings", label: "RELATED_EVENT" },
  { a: "Ice storm strands hundreds of motorists on Route 9 near Tarnley", b: "Tarnley reviews storm alerts after Route 9 strandings", label: "RELATED_EVENT" },
  { a: "Elmsworth hospital nurses vote to authorize strike", b: "Elmsworth hospital and nurses reach tentative deal, averting strike", label: "RELATED_EVENT" },
  { a: "Yarrowdale approves free transit for riders under 18", b: "Youth ridership jumps forty percent under Yarrowdale free-fare plan", label: "RELATED_EVENT" },
  { a: "Grid operator warns Ardenfell faces winter power shortfall", b: "Ardenfell fast-tracks two gas peaker plants after shortfall warning", label: "RELATED_EVENT" },
  { a: "Quenby startup unveils biodegradable packaging foam", b: "Grocery chain to pilot Quenby startup's biodegradable foam", label: "RELATED_EVENT" },
  { a: "Salmonella outbreak tied to Quithby sprout farm sickens 22", b: "Quithby sprout farm shut down pending inspection", label: "RELATED_EVENT" },
  { a: "Averston Knights goalkeeper Piet Malloy suspended four games", b: "Averston Knights slump continues with Malloy sidelined", label: "RELATED_EVENT" },
  { a: "Wind farm off Gullwing Bay clears final environmental review", b: "Construction vessels arrive for Gullwing Bay wind farm build", label: "RELATED_EVENT" },
  { a: "Chef Omar Pell's Torvane bistro earns top culinary award", b: "Reservations at Omar Pell's bistro booked out three months", label: "RELATED_EVENT" },
  { a: "Counterfeit medicine ring broken up in Kelmsley raids", b: "Kelmsley pharmacists urged to verify stock after counterfeit bust", label: "RELATED_EVENT" },
  { a: "Drought forces Kembervale to tap emergency reservoir", b: "Kembervale imposes lawn watering ban as drought deepens", label: "RELATED_EVENT" },
  { a: "Comet dust samples returned by Melvicia space probe", b: "First analysis of Melvicia probe's comet dust surprises researchers", label: "RELATED_EVENT" },
  { a: "Ganlow bans gas leaf blowers starting next year", b: "Landscapers press Ganlow for leaf blower ban exemptions", label: "RELATED_EVENT" },
  { a: "Mudslide severs rail link between Thornbay and Merrow Pass", b: "Bus bridge set up while Thornbay–Merrow Pass rail line is repaired", label: "RELATED_EVENT" },
  { a: "Scientists map genome of blight-resistant Sorvale wheat", b: "Seed companies license blight-resistant wheat developed in Sorvale", label: "RELATED_EVENT" },
  { a: "Storm surge floods Delune boardwalk businesses", b: "Delune boardwalk owners demand seawall funding after floods", label: "RELATED_EVENT" },
  { a: "Halden Rovers snatch last minute win over Kerrick United", b: "Halden Rovers edge Foxdale Athletic in extra time thriller", label: "RELATED_EVENT" },
  { a: "Ombria central bank raises key rate to cool inflation", b: "Ombria central bank holds rate steady at following meeting", label: "RELATED_EVENT" },
  { a: "Larkspur symphony cancels season amid funding shortfall", b: "Larkspur symphony announces comeback season after donor rescue", label: "RELATED_EVENT" },
  { a: "Wexley Zoo announces birth of rare snow leopard cub", b: "Wexley Zoo names snow leopard cub after public vote", label: "RELATED_EVENT" },
  { a: "Judge approves settlement in Oxcombe water contamination suit", b: "First payments reach families in Oxcombe water settlement", label: "RELATED_EVENT" },
  { a: "Delune Port workers ratify deal, avoiding shutdown", b: "Delune Port traffic rebounds after labor deal", label: "RELATED_EVENT" },
  { a: "Bridge inspection closes Harrow Crossing for a week", b: "Harrow Crossing reopens early after inspection finds no faults", label: "RELATED_EVENT" },
  { a: "Rare comet Vell-Tarrow visible this week across northern skies", b: "Photographers share stunning images of comet Vell-Tarrow", label: "RELATED_EVENT" },
  { a: "Solar farm approved on former Serpington landfill site", b: "Serpington landfill solar farm connects to grid", label: "RELATED_EVENT" },
  { a: "Whale stranded on Culverstone sandbar refloated by volunteers", b: "Refloated whale spotted swimming offshore, trackers confirm", label: "RELATED_EVENT" },
  { a: "Lightning strike sparks fire at Kestrel Range lookout tower", b: "Rebuilt Kestrel Range lookout tower reopens to hikers", label: "RELATED_EVENT" },
  { a: "Retiring judge Hale Morrow reflects on 25 years on bench", b: "Hale Morrow appointed to lead sentencing reform panel", label: "RELATED_EVENT" },
  { a: "Fuel spill closes stretch of Harrow River to boaters", b: "Harrow River reopens to boats after spill cleanup", label: "RELATED_EVENT" },
  { a: "Winslade teen wins national spelling title on 19th round", b: "Winslade spelling champion gets hometown parade", label: "RELATED_EVENT" },
  { a: "Pothole damage claims triple after harsh Hexbury winter", b: "Hexbury adds night crews to tackle pothole backlog", label: "RELATED_EVENT" },
  { a: "Youth coding camp expands to five Bryndor towns", b: "Coding camp graduates showcase apps at Bryndor fair", label: "RELATED_EVENT" },
  { a: "Beekeepers report record honey harvest across Umberley", b: "Umberley honey wins top prize at regional fair", label: "RELATED_EVENT" },

  // ── DIFFERENT_EVENT — unrelated stories ──────────────────────────────
  { a: "Quillbrook city council approves downtown transit tunnel", b: "Rare orchid rediscovered in Tarn Hollow bog after 80 years", label: "DIFFERENT_EVENT" },
  { a: "Ferry capsizes off Port Delune, twelve rescued", b: "Chess prodigy Nils Ordan, 14, earns grandmaster title", label: "DIFFERENT_EVENT" },
  { a: "Ombria central bank raises key rate to cool inflation", b: "Wexley Zoo announces birth of rare snow leopard cub", label: "DIFFERENT_EVENT" },
  { a: "Landslide buries highway near Merrow Pass, no injuries reported", b: "Novelist Ida Prenn wins Calder Prize for fiction", label: "DIFFERENT_EVENT" },
  { a: "Pellagrin chemical plant fire forces overnight evacuation", b: "Yarrowdale approves free transit for riders under 18", label: "DIFFERENT_EVENT" },
  { a: "Halden Rovers sign striker Dario Ventisi on three-year deal", b: "Study links Ivermoss well water to elevated arsenic", label: "DIFFERENT_EVENT" },
  { a: "Storm Pell knocks out power to 40,000 homes across Grelloway", b: "Auction of shipwreck gold coins nets record 3 million", label: "DIFFERENT_EVENT" },
  { a: "Rensley Pharma recalls blood pressure drug over labeling error", b: "Vintage aircraft rally returns to Ellsmere airfield", label: "DIFFERENT_EVENT" },
  { a: "Miners freed after three days trapped underground at Bell Creek", b: "Cheese festival sets attendance record in Tarn Hollow", label: "DIFFERENT_EVENT" },
  { a: "Regulator fines Vexbridge Bank over misleading mortgage ads", b: "Endangered condor chick hatches in Rooksmere breeding program", label: "DIFFERENT_EVENT" },
  { a: "Tornado tears through Jarrowfen farmland, destroying barns", b: "Publisher Harrow Press files for bankruptcy protection", label: "DIFFERENT_EVENT" },
  { a: "Pellow Islands declare emergency as cyclone nears", b: "Chef Omar Pell's Torvane bistro earns top culinary award", label: "DIFFERENT_EVENT" },
  { a: "Grain terminal explosion injures four at Port Averil", b: "Youth coding camp expands to five Bryndor towns", label: "DIFFERENT_EVENT" },
  { a: "Rathmoor voters reject casino referendum by wide margin", b: "Whale stranded on Culverstone sandbar refloated by volunteers", label: "DIFFERENT_EVENT" },
  { a: "Archaeologists uncover Bronze Age settlement near Tarn Hollow", b: "Kestrel Airways cancels hundreds of flights as crews strike", label: "DIFFERENT_EVENT" },
  { a: "Kerrick United sack manager after winless month", b: "Toxic algae bloom closes beaches along Gullwing Bay", label: "DIFFERENT_EVENT" },
  { a: "Data breach at Loomis Retail exposes customer records", b: "Rare comet Vell-Tarrow visible this week across northern skies", label: "DIFFERENT_EVENT" },
  { a: "Police arrest suspect in Vorley gallery art theft", b: "Beekeepers report record honey harvest across Umberley", label: "DIFFERENT_EVENT" },
  { a: "Brantley Motors recalls 80,000 pickups over brake defect", b: "Youth orchestra from Selwick invited to Vestria festival", label: "DIFFERENT_EVENT" },
  { a: "Wildcat strike shuts Drossfield copper mine", b: "Measles outbreak grows to 40 cases in Harlow County", label: "DIFFERENT_EVENT" },
  { a: "Flooding closes schools across Hobbenshire", b: "Actor Vessa Marn to lead revival of stage classic in Delverton", label: "DIFFERENT_EVENT" },
  { a: "Astronomers detect water vapor on distant exoplanet Veyra-4b", b: "Delune fishermen protest quota cuts outside ministry", label: "DIFFERENT_EVENT" },
  { a: "Fenwick Dairy plant to close, cutting 300 jobs", b: "Historic lighthouse at Cape Averil opens to overnight guests", label: "DIFFERENT_EVENT" },
  { a: "Senator Mara Quill resigns over ethics probe", b: "Champion mare Silverquill retired to stud after injury", label: "DIFFERENT_EVENT" },
  { a: "Oil spill contained near Gullwing Bay after tanker leak", b: "Winslade teen wins national spelling title on 19th round", label: "DIFFERENT_EVENT" },
  { a: "Wrenfield University freezes tuition for two years", b: "Ice storm strands hundreds of motorists on Route 9 near Tarnley", label: "DIFFERENT_EVENT" },
  { a: "Cyclist Beno Farrell wins Tour of Vestria in final sprint", b: "Counterfeit medicine ring broken up in Kelmsley raids", label: "DIFFERENT_EVENT" },
  { a: "Judge approves settlement in Oxcombe water contamination suit", b: "Retired teacher donates rare map collection to Harleth library", label: "DIFFERENT_EVENT" },
  { a: "Historic Bramwick mill destroyed in overnight blaze", b: "Scientists map genome of blight-resistant Sorvale wheat", label: "DIFFERENT_EVENT" },
  { a: "Delune Port workers ratify deal, avoiding shutdown", b: "Rare orchid rediscovered in Tarn Hollow bog after 80 years", label: "DIFFERENT_EVENT" },
  { a: "Glass sculptor Renn Odlum's retrospective opens at Corvale Museum", b: "Grid operator warns Ardenfell faces winter power shortfall", label: "DIFFERENT_EVENT" },
  { a: "Vestria lifts visa requirement for Pellow Islands travelers", b: "Two firefighters injured battling Tarn Hollow warehouse blaze", label: "DIFFERENT_EVENT" },
  { a: "Quake of magnitude 5.8 rattles coastal Skerritt, minor damage", b: "Chef Omar Pell's Torvane bistro earns top culinary award", label: "DIFFERENT_EVENT" },
  { a: "Averston Knights retire number of longtime captain Jory Ashe", b: "Solar farm approved on former Serpington landfill site", label: "DIFFERENT_EVENT" },
  { a: "Startup Lumenfold raises 40 million for battery recycling", b: "Mudslide severs rail link between Thornbay and Merrow Pass", label: "DIFFERENT_EVENT" },
  { a: "Bridge inspection closes Harrow Crossing for a week", b: "Champion swimmer Lira Vosk breaks national 200m record", label: "DIFFERENT_EVENT" },
  { a: "Kestwick council votes to ban single-use plastics", b: "Fraud trial of Delmont financier Aro Kesh begins", label: "DIFFERENT_EVENT" },
  { a: "Vandermoor Steel furnace restart delayed by safety review", b: "Night market pilot draws thousands to Delverton waterfront", label: "DIFFERENT_EVENT" },
  { a: "Avian flu detected at second Jorrel Basin poultry farm", b: "Museum returns looted bronze statues to Pellow Islands", label: "DIFFERENT_EVENT" },
  { a: "Marnholt opera house reopens after decade-long restoration", b: "Pothole damage claims triple after harsh Hexbury winter", label: "DIFFERENT_EVENT" },
  { a: "Dunmarsh approves congestion charge for downtown drivers", b: "Salmonella outbreak tied to Quithby sprout farm sickens 22", label: "DIFFERENT_EVENT" },
  { a: "Missing kayaker found safe on Lake Merrin islet", b: "Vexbridge Bank names Petra Solis chief executive", label: "DIFFERENT_EVENT" },
  { a: "Heat wave shatters temperature records across Tessary", b: "Librarians digitize Tessary's oldest newspaper archive", label: "DIFFERENT_EVENT" },
  { a: "Faylen voters back new arena in narrow referendum", b: "Fuel spill closes stretch of Harrow River to boaters", label: "DIFFERENT_EVENT" },
  { a: "Researchers reverse hearing loss in mice using gene therapy", b: "Farmers market vendor fined over mislabeled organic produce", label: "DIFFERENT_EVENT" },
  { a: "Airline Kestrel adds direct route between Averston and Pellow Islands", b: "Court orders Yarrick landlord to repay withheld deposits", label: "DIFFERENT_EVENT" },
  { a: "Ednam approves rent stabilization for older buildings", b: "Lightning strike sparks fire at Kestrel Range lookout tower", label: "DIFFERENT_EVENT" },
  { a: "Power returns to Sablewick grid after substation repair", b: "Cheese festival sets attendance record in Tarn Hollow", label: "DIFFERENT_EVENT" },
  { a: "Vestria parliament ratifies fisheries treaty with Norwick", b: "Marathoner Edda Kyle disqualified over course shortcut", label: "DIFFERENT_EVENT" },
  { a: "Cresmoor transit strike ends with binding arbitration deal", b: "Comet dust samples returned by Melvicia space probe", label: "DIFFERENT_EVENT" },
  { a: "Pryorsfield food bank reports record demand amid rising prices", b: "Vandals damage centuries-old carvings at Merrow Pass site", label: "DIFFERENT_EVENT" },
  { a: "Wexcott approves budget with deep cuts to road maintenance", b: "Whale stranded on Culverstone sandbar refloated by volunteers", label: "DIFFERENT_EVENT" },
  { a: "Polwick ferry fares to rise 8 percent in spring", b: "Rare orchid rediscovered in Tarn Hollow bog after 80 years", label: "DIFFERENT_EVENT" },
  { a: "Quorland bans smartphones in elementary classrooms", b: "Storm surge floods Delune boardwalk businesses", label: "DIFFERENT_EVENT" },
  { a: "Sinkhole swallows section of Cabrell street, no one hurt", b: "Beekeepers report record honey harvest across Umberley", label: "DIFFERENT_EVENT" },
  { a: "Wind farm off Gullwing Bay clears final environmental review", b: "Veteran anchor Tomas Breel signs off after 30 years", label: "DIFFERENT_EVENT" },
  { a: "Bus depot roof collapses under snow in Zellcombe, none injured", b: "Champion angler Rilla Voss loses title over rule breach", label: "DIFFERENT_EVENT" },
  { a: "Pellow Islands sign undersea cable deal to boost internet", b: "Tindale shelter waives adoption fees amid overcrowding", label: "DIFFERENT_EVENT" },
  { a: "Drought forces Marrow Valley to tap emergency reservoir", b: "Textile mill conversion brings 200 apartments to Ulverdale", label: "DIFFERENT_EVENT" },
  { a: "Referee shortage delays start of Foxdale youth league", b: "Fennwich museum acquires long-lost Ferren seascape painting", label: "DIFFERENT_EVENT" },
  { a: "Ostenholm airport unveils expanded international terminal", b: "Retiring judge Hale Morrow reflects on 25 years on bench", label: "DIFFERENT_EVENT" },
];
