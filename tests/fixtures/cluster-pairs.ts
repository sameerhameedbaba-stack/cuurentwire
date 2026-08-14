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
    a: "Explosion at Delverton chemical plant forces overnight evacuation",
    b: "Blast at chemical plant in Delverton prompts evacuation overnight",
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
    a: "Explosion at Delverton chemical plant forces overnight evacuation",
    b: "Delverton chemical plant fined over safety violations last year",
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
    a: "Explosion at Delverton chemical plant forces overnight evacuation",
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
    b: "Blast at chemical plant in Delverton prompts evacuation overnight",
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
];
