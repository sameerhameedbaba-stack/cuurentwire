import type { CategoryId } from "@/config/categories";
import type { ContentType, Country } from "@/lib/news/types";

/**
 * Labeled evaluation fixtures for the category and geography classifiers.
 *
 * All headlines are synthetic-but-realistic, written for this suite — except
 * a handful of short examples quoted verbatim from the production audit
 * (marked "audit"), kept as regression inputs for real observed failures.
 *
 * highConfidence: true marks examples any reasonable news reader would label
 * without hesitation — the accuracy gate in classification-quality.test.ts
 * applies to those. highConfidence: false marks genuinely ambiguous or
 * known-hard inputs (they count toward the reported overall accuracy only).
 */

export interface CategoryFixture {
  title: string;
  description?: string;
  sourceCountry?: "US" | "CA" | "INTL";
  providerCategory?: string;
  providerCategoryIsPrior?: boolean;
  expectedCategory: CategoryId;
  highConfidence: boolean;
}

export interface GeographyFixture {
  title: string;
  description?: string;
  sourceCountry?: "US" | "CA" | "INTL";
  providerCountry?: string;
  expectedGeography: Country;
  highConfidence: boolean;
}

const c = (
  title: string,
  expectedCategory: CategoryId,
  highConfidence = true,
  extra: Partial<CategoryFixture> = {},
): CategoryFixture => ({ title, expectedCategory, highConfidence, ...extra });

// ───────────────────────────── Category ─────────────────────────────

const POLITICS: CategoryFixture[] = [
  c("Senate passes sweeping immigration bill after marathon session", "politics"),
  c("White House unveils executive order on drug pricing", "politics"),
  c("Congress approves stopgap funding measure to avert shutdown", "politics"),
  c("Governor signs state legislature redistricting plan into law", "politics"),
  c("Supreme Court agrees to hear challenge to federal gun regulation", "politics"),
  c("Ontario premier shuffles cabinet ahead of byelection", "politics"),
  c("Liberal Party unveils campaign platform ahead of federal election", "politics"),
  c("NDP pushes for new dental legislation in confidence vote", "politics"),
  c("House speaker faces pressure over budget impasse", "politics"),
  c("Attorney general names special counsel in ethics probe", "politics"),
  c("Lawmakers spar over defence spending in committee hearing", "politics"),
  c("Presidential campaign enters final stretch with battleground blitz", "politics"),
  c("Voters head to the polls in tightly contested byelection", "politics"),
  c("Cabinet minister resigns over expense scandal", "politics"),
  c("Senator introduces bill to expand rural broadband access", "politics"),
  c("Impeachment inquiry moves to public hearings", "politics"),
  c("Premier defends budget in heated legislature exchange", "politics"),
  c("MPs debate national security legislation in Ottawa", "politics"),
  c("Republican leadership backs down on shutdown threat", "politics"),
  c("Democrats unveil housing affordability package", "politics"),
  c("Governor general delivers throne speech opening parliament", "politics"),
  c("A tense week ahead on Parliament Hill", "politics", true, {
    description:
      "MPs return for question period as the minority government faces a confidence vote.",
  }),
  c("Leaders trade barbs ahead of first debate", "politics", true, {
    providerCategory: "politics",
  }),
  c("Election watchdog fines campaign over finance violations", "politics"),
  c("Bloc Québécois demands more provincial autonomy in Ottawa", "politics"),
  c("City council byelection draws record advance ballots", "politics"),
  c("Minister faces questions over procurement contract", "politics"),
  c("Conservative Party picks new leader after long convention", "politics"),
];

const BUSINESS: CategoryFixture[] = [
  c("Federal Reserve holds interest rate steady as inflation cools", "business"),
  c("Stocks rally as tech earnings top expectations", "business"),
  c("Bank of Canada cuts key interest rate amid slowing economy", "business"),
  c("Unemployment rate ticks up as hiring slows", "business"),
  c("Housing market cools as mortgage rates stay elevated", "business"),
  c("Major airline announces merger with regional carrier", "business"),
  c("Retail sales fall for third straight month", "business"),
  c("TSX closes at record high on energy rally", "business"),
  c("Quarterly profit beats forecasts at largest grocery chain", "business"),
  c("Auto union votes to strike at midnight", "business"),
  c("Layoffs mount across manufacturing sector amid weak demand", "business"),
  c("IPO market thaws as software maker files to go public", "business"),
  c("Dow Jones slides 500 points on rate fears", "business"),
  c("Oil prices spike after supply disruption", "business"),
  c("GDP growth slows to 1.2 percent in second quarter", "business"),
  c("Wall Street banks report stronger trading revenue", "business"),
  c("Startup funding rebounds as investors chase AI deals", "business"),
  c("Grocery chains face scrutiny over price increases as inflation bites", "business"),
  c("Trade deal talks resume between major economies", "business"),
  c("Manufacturing activity contracts for sixth month", "business"),
  c("Consumer spending holds up despite higher borrowing costs", "business"),
  c("Bay Street eyes earnings season as loonie weakens", "business"),
  c("Shipping giant warns of softer demand", "business", true, {
    providerCategory: "business",
  }),
  c("Streaming service raises subscription prices to boost revenue", "business"),
  c("S&P 500 notches record close as yields ease", "business"),
  c("Small businesses brace for new tariffs on imports", "business"),
  c("Mortgage delinquencies rise in overheated markets", "business"),
  c("Union and employer reach deal to end port strike", "business"),
  c("What the latest jobs numbers mean for you", "business", true, {
    description:
      "The monthly jobs report showed hiring moderating while unemployment held steady.",
  }),
];

const TECHNOLOGY: CategoryFixture[] = [
  c("OpenAI releases new AI model with improved reasoning", "technology"),
  c("Chipmaker unveils next-generation semiconductor for data centers", "technology"),
  c("Ransomware gang hits school districts in latest cybersecurity breach", "technology"),
  c("Social media platforms face new rules on teen accounts", "technology"),
  c("Quantum computing startup claims error-correction milestone", "technology"),
  c("New smartphone lineup bets big on on-device AI", "technology"),
  c("Cybersecurity officials warn of state-backed hack targeting utilities", "technology"),
  c("Data breach exposes millions of customer records", "technology"),
  c("Self-driving trucks begin commercial routes", "technology"),
  c("Electric vehicle sales surge as charging network expands", "technology"),
  c("App store rules under fire as antitrust case heads to court", "technology"),
  c("Google faces landmark antitrust ruling over search dominance", "technology"),
  c("Nvidia earnings soar on AI chip demand", "technology"),
  c("Cloud computing prices climb as data center demand outpaces supply", "technology"),
  c("Machine learning models get better at writing software", "technology"),
  c("5G rollout reaches rural communities", "technology"),
  c("Streaming platform tests cheaper ad-supported tier", "technology"),
  c("Encryption backdoor proposal draws privacy backlash", "technology"),
  c("Gaming studios embrace cloud streaming for new titles", "technology"),
  c("Robotics firm shows off warehouse automation", "technology"),
  c("Silicon Valley venture funding rebounds", "technology"),
  c("Broadband subsidies expand access in remote communities", "technology"),
  c("Firm unveils updated developer tools", "technology", true, {
    providerCategory: "technology",
  }),
  c("Hands-on with the new folding phone", "technology", true, {
    providerCategory: "technology",
    providerCategoryIsPrior: true,
  }),
  c("Artificial intelligence reshapes customer service jobs", "technology"),
  c("Chip shortage eases as new fabs come online", "technology"),
  c("Tech company doubles down on overseas expansion", "technology", false),
  c("Antitrust regulators open probe into app store payments", "technology"),
  // Hard negative: crime story with tech nouns — known-hard for a keyword
  // classifier, kept honest as low-confidence.
  c("Police recover stolen smartphones after warehouse break-in", "world", false),
];

const WORLD: CategoryFixture[] = [
  // audit: NPR/BBC/CBS versions all landed in technology ("app" in "kidnapped").
  c("U.S. missionary who was kidnapped in Niger is released", "world"),
  c("Security council weighs new sanctions over missile tests", "world"),
  c("Ceasefire talks stall as airstrikes resume", "world"),
  c("Foreign minister summons ambassador over embassy raid", "world"),
  c("G7 leaders gather for summit in Tokyo", "world"),
  c("Refugee crisis deepens as thousands flee border region", "world"),
  c("Militants seize northern town as peacekeepers withdraw", "world"),
  c("Coup attempt fails after military units defect", "world"),
  c("Hostage negotiations continue after aid convoy attack", "world"),
  c("European Union weighs response to energy blockade", "world"),
  c("Diplomatic breakthrough eases tensions between neighbours", "world"),
  c("Peace talks resume in Geneva after months of deadlock", "world"),
  c("Humanitarian corridor opens for besieged city", "world"),
  c("Kyiv reports overnight drone barrage on power grid", "world"),
  c("Beijing and Moscow deepen trade ties at summit", "world"),
  c("War crimes tribunal opens hearings on wartime atrocities", "world"),
  c("Insurgents ambush patrol near mountain pass", "world"),
  c("Treaty on deep-sea mining clears final hurdle", "world"),
  c("State visit strengthens ties between London and Paris", "world"),
  c("International observers denounce disputed vote", "world"),
  c("Sanctions tighten on shadow oil fleet", "world"),
  c("Border dispute flares as troops mass along frontier", "world"),
  c("Asia-Pacific allies stage joint naval drills", "world"),
  c("Regional powers scramble after surprise offensive", "world", true, {
    providerCategory: "world",
  }),
  c("Kidnapping surge prompts travel warnings in the region", "world"),
  c("Global food program warns of famine risk", "world"),
  c("Berlin hosts emergency summit on migration", "world"),
  // audit-flavor: the Nigerian vultures story must never be technology.
  c("Nigeria's disappearing vultures alarm communities across West Africa", "world"),
];

const CLIMATE: CategoryFixture[] = [
  c("Wildfire smoke blankets prairie cities as evacuation orders expand", "climate"),
  c("Hurricane strengthens to category 4 as coastal towns brace", "climate"),
  c("Heat wave shatters temperature records across the southwest", "climate"),
  c("Flooding forces hundreds from homes after record rainfall", "climate"),
  c("Carbon emissions hit new global high despite pledges", "climate"),
  c("Drought conditions worsen for third straight summer", "climate"),
  c("New pipeline project faces environmental review", "climate"),
  c("Renewable energy capacity outpaces coal for first time", "climate"),
  c("Solar power installations double as panel prices fall", "climate"),
  c("Oil sands operators pledge net zero by 2050", "climate"),
  c("Blizzard shuts highways as extreme weather grips region", "climate"),
  c("Tornado outbreak leaves trail of destruction", "climate"),
  c("Glacier retreat accelerates in warming mountain ranges", "climate"),
  c("EPA tightens pollution limits for power plants", "climate"),
  c("Sea level rise threatens coastal infrastructure", "climate"),
  c("Biodiversity loss accelerates as wetlands shrink", "climate"),
  c("Electric grid upgrades planned ahead of storm season", "climate"),
  c("Clean energy projects break ground across the region", "climate"),
  c("Fossil fuel subsidies under scrutiny at climate summit", "climate"),
  c("Conservation groups push to protect old-growth forest", "climate"),
  c("Climate change fuels longer allergy seasons", "climate"),
  c("Wind power farms face local zoning fights", "climate"),
  c("Storm system tracks east with damaging winds", "climate", true, {
    providerCategory: "weather",
  }),
  c("Environmental review delays mining expansion", "climate"),
  c("Net zero targets slip as emissions rebound", "climate"),
  c("Heatwave warnings issued for a third consecutive week", "climate"),
  c("Flood defences hold as river crests below forecast", "climate"),
  c("Wildfire season starts early amid tinder-dry conditions", "climate"),
];

const HEALTH: CategoryFixture[] = [
  c("New vaccine shows strong protection in clinical trial", "health"),
  c("Hospital overcrowding strains emergency departments", "health"),
  c("FDA approves first at-home test for chronic illness", "health"),
  c("Measles outbreak spreads to neighbouring counties", "health"),
  c("Mental health services expand in rural schools", "health"),
  c("Opioid settlement funds addiction treatment programs", "health"),
  c("Cancer screening rates rebound after years of decline", "health"),
  c("Nurses report rising burnout in new national survey", "health"),
  c("Medicare expands coverage for weight-loss drugs", "health"),
  c("Health Canada recalls batch of blood pressure medication", "health"),
  c("CDC issues new guidance on respiratory virus season", "health"),
  c("Physician shortage worsens in northern communities", "health"),
  c("Clinical trial results boost hopes for Alzheimer's treatment", "health"),
  c("Prescription drug prices draw scrutiny from regulators", "health"),
  c("Public health officials urge earlier flu shots", "health"),
  c("Surgery backlog shrinks as operating rooms add weekend shifts", "health"),
  c("Disease surveillance network expands after avian flu scare", "health"),
  c("Patients face long waits for specialist referrals", "health"),
  c("Vaccination rates dip among school-age children", "health"),
  c("Healthcare workers rally for safer staffing ratios", "health"),
  c("Drug approval process faces overhaul under new proposal", "health"),
  c("Epidemic preparedness plan gets funding boost", "health"),
  c("New walk-in clinic model spreads to more cities", "health", true, {
    providerCategory: "health",
  }),
  c("Hospital network invests in operating room upgrades", "health"),
  c("Medicaid work requirements blocked by federal judge", "health"),
  c("Mental health apps face scrutiny over data practices", "health"),
  c("Opioid crisis response shifts to harm reduction", "health"),
  c("Virus variant drives uptick in hospital admissions", "health"),
];

const SCIENCE: CategoryFixture[] = [
  c("NASA sets new date for moon mission after delay", "science"),
  c("SpaceX completes crewed launch to orbiting research station", "science"),
  c("James Webb telescope spots earliest known galaxy", "science"),
  c("Astronomers track asteroid passing close to Earth", "science"),
  c("Study finds gut microbes influence sleep quality", "science"),
  c("Researchers map genome of ancient horse breed", "science"),
  c("Fossil discovery rewrites story of early birds", "science"),
  c("Physics experiment hints at new fundamental particle", "science"),
  c("Marine scientists document new deep-sea species", "science"),
  c("Canadian Space Agency announces new astronaut class", "science"),
  c("Mars rover drills into ancient lakebed", "science"),
  c("Quantum researchers demonstrate error-free logic gates", "science"),
  c("Satellite constellation to monitor methane leaks", "science"),
  c("Archaeology team uncovers Bronze Age settlement", "science"),
  c("Laboratory breakthrough could cut battery costs", "science"),
  c("Peer-reviewed study links exercise to memory gains", "science"),
  c("Rocket launch scrubbed minutes before liftoff", "science"),
  c("Space station crew begins spacewalk to fix solar array", "science"),
  c("Chemistry prize honours work on synthetic catalysts", "science"),
  c("Scientists revive 40,000-year-old moss from permafrost", "science"),
  c("New telescope array begins scanning southern sky", "science"),
  c("Genome editing shows early promise against rare disorders", "science"),
  c("Why octopuses dream: new evidence emerges", "science", true, {
    providerCategory: "science",
  }),
  c("Spacecraft beams back first images from icy moon", "science"),
  c("Research consortium maps the brain's wiring diagram", "science"),
  c("Experiment recreates conditions of the early universe", "science"),
  c("Asteroid sample reveals building blocks of life", "science"),
  // audit-flavor: vultures + scientists must land in science, not technology.
  c("Nigeria's vultures are disappearing and scientists are worried", "science"),
];

const CULTURE: CategoryFixture[] = [
  // audit: was classified technology.
  c(
    "I'm a neuroscientist. Here's why our brains need pop concerts | Bala Subramaniam",
    "culture",
  ),
  // audit-flavor: Kelce/Swift wedding coverage was classified business.
  c("Travis Kelce and Taylor Swift wedding: everything we know so far", "culture"),
  c("Box office rebounds as sequel tops weekend charts", "culture"),
  c("Film festival lineup features record number of debuts", "culture"),
  c("Pop star announces stadium concert tour", "culture"),
  c("Novel about prairie childhood wins national book award", "culture"),
  c("Museum unveils immersive art exhibit", "culture"),
  c("Streaming series breaks viewership records", "culture"),
  c("Oscars ceremony draws biggest audience in years", "culture"),
  c("Broadway revival earns rave reviews", "culture"),
  c("Grammys spotlight rising country singers", "culture"),
  c("Documentary about cave divers tops the charts", "culture"),
  c("Celebrity chef opens third restaurant", "culture"),
  c("Author's debut novel sparks bidding war", "culture"),
  c("Theatre company stages outdoor Shakespeare season", "culture"),
  c("Album of duets revives interest in jazz standards", "culture"),
  c("Rapper's surprise album breaks streaming records", "culture"),
  c("Red carpet looks steal the show at film premiere", "culture"),
  c("Television reboot leans on nostalgia", "culture"),
  c("Podcast network expands into live events", "culture"),
  c("Journalism awards honour investigative series", "culture"),
  c("Songwriter hall of fame inducts new class", "culture"),
  c("Actor lands lead role in spy thriller", "culture"),
  c("Actress opens up about stage fright", "culture"),
  c("Inside the year's most talked-about premiere", "culture", true, {
    providerCategory: "entertainment",
  }),
  c("Royal wedding draws millions of viewers", "culture"),
  c("Music festival adds second weekend after sellout", "culture"),
  c("Late-night TV series shakes up its format", "culture"),
  // Hard negative: business vocabulary in an entertainment story.
  c("Movie studio reports record box office revenue", "culture"),
];

const SPORTS: CategoryFixture[] = [
  // audit (geography case), here as a category input via the ESPN feed prior.
  c("Transfer rumors, news: Arsenal hold talks over Osimhen deal", "sports", true, {
    description: "The latest Premier League transfer news from Europe's top clubs.",
    providerCategory: "sports",
    providerCategoryIsPrior: true,
  }),
  c("Quarterback controversy dominates playoff media day", "sports"),
  c("Maple Leafs rally in third period to extend win streak", "sports"),
  c("Blue Jays complete blockbuster trade ahead of deadline", "sports"),
  c("NFL owners approve expanded playoff format", "sports"),
  c("NBA finals set ratings record in overtime thriller", "sports"),
  c("Stanley Cup rematch renews bitter rivalry", "sports"),
  c("Super Bowl halftime lineup announced", "sports"),
  c("World Cup qualifying heats up in final window", "sports"),
  c("Premier League title race tightens after dramatic derby", "sports"),
  c("Champions League draw pits holders against underdogs", "sports"),
  c("Transfer window closes with flurry of deadline moves", "sports"),
  c("Raptors rookie shines in preseason opener", "sports"),
  c("Grey Cup ticket demand hits decade high", "sports"),
  c("Oilers sign veteran goaltender to one-year contract", "sports"),
  c("Tennis star completes career sweep of majors", "sports"),
  c("Golf major reshuffles pairings for final round", "sports"),
  c("Hockey world mourns broadcasting legend", "sports"),
  c("College basketball tips off with upset special", "sports"),
  c("Baseball's pitch clock speeds up games again", "sports"),
  c("Quarterback throws six touchdowns in playoff rout", "sports"),
  c("Olympic committee adds new mixed relay events", "sports"),
  c("CFL expands video review for contested catches", "sports"),
  c("Canucks blow late lead, drop fourth straight", "sports"),
  c("Soccer star nets hat trick in derby win", "sports"),
  c("Coach shakes up roster after slow start", "sports"),
  c("PGA Tour unveils fall schedule changes", "sports"),
  c("MLS playoff push comes down to final matchday", "sports"),
  c("NHL trade deadline passes with contenders loading up", "sports"),
  // Hard negative: labor-dispute vocabulary in a sports story — genuinely
  // ambiguous for a keyword classifier, kept honest as low-confidence.
  c("League and players union near new labor deal", "sports", false),
];

// The internal low-confidence bucket: headlines with no usable section
// signal must land in "general" — NEVER in world (world is earned by
// international-affairs evidence like any other category).
const GENERAL: CategoryFixture[] = [
  // Pre-general era this expected "world" as the fallback bucket.
  c("Completely generic headline about nothing in particular", "general"),
  c("Five things to know before the weekend", "general"),
  c("What we learned this week", "general"),
  c("Photos of the day", "general"),
  c("Morning briefing: your Tuesday roundup", "general"),
  c("The week in review", "general"),
  c("Quiz: how closely did you follow the headlines?", "general"),
];

export const categoryFixtures: CategoryFixture[] = [
  ...POLITICS,
  ...BUSINESS,
  ...TECHNOLOGY,
  ...WORLD,
  ...CLIMATE,
  ...HEALTH,
  ...SCIENCE,
  ...CULTURE,
  ...SPORTS,
  ...GENERAL,
];

// ───────────────────────────── Geography ─────────────────────────────

const GEO_US: GeographyFixture[] = [
  c2("Congress debates federal budget framework in Washington", "US"),
  c2("White House outlines plan to lower drug costs", "US"),
  c2("Senate committee advances judicial nominations", "US"),
  c2("California wildfire forces evacuations near state park", "US"),
  c2("Texas power grid faces summer stress test", "US"),
  c2("New York subway expansion clears funding hurdle", "US"),
  c2("Florida braces for hurricane landfall", "US"),
  c2("Pentagon reviews aid package delays", "US"),
  c2("Federal Reserve officials split on rate path", "US"),
  c2("Supreme Court to hear social media case", "US"),
  c2("FBI arrests suspect in cargo theft ring", "US"),
  c2("Medicare premiums to rise next year", "US"),
  c2("Wall Street rally lifts retirement accounts", "US"),
  c2("Seattle tech workers face new round of layoffs", "US"),
  c2("Chicago teachers reach tentative contract", "US"),
  c2("Los Angeles unveils transit plan ahead of the Games", "US"),
  c2("Boston hospital pilots AI triage system", "US"),
  c2("Houston refinery outage lifts gas prices", "US"),
  c2("Atlanta airport tops passenger rankings again", "US"),
  c2("Detroit automakers bet on hybrid comeback", "US"),
  c2("San Francisco office vacancies hit record", "US"),
  c2("Philadelphia shipyard lands submarine contract", "US"),
  c2("Biden aides defend budget priorities in new memoir", "US"),
  c2("Trump administration weighs new tariffs on imports", "US"),
  c2("Governor vetoes state budget over school funding", "US"),
  c2("IRS backlog delays refunds for millions", "US"),
  c2("NASA awards lunar lander contract", "US"),
  c2("Capitol Hill braces for shutdown fight", "US"),
  c2("GOP unveils border security bill", "US"),
  c2("Democrats and Republicans clash over debt limit", "US"),
  c2("National Guard deployed after levee breach", "US"),
  c2("Veterans Affairs expands mental health coverage", "US"),
  c2("Homeland Security updates travel screening rules", "US"),
  c2("Midterm turnout projected to break records", "US"),
  c2("District of Columbia statehood bill reintroduced", "US"),
  // audit: category was the failure; geography is correctly US.
  c2("U.S. missionary who was kidnapped in Niger is released", "US"),
  c2("State Department issues new travel advisory", "US"),
  c2("CIA declassifies cold war files", "US"),
  c2("EPA finalizes tailpipe emission rules", "US"),
  c2("FDA clears new insulin pump", "US"),
  c2("CDC tracks rise in respiratory illness", "US"),
  c2("Medicaid enrollment shifts strain state budgets", "US"),
  c2("Pennsylvania senate race enters final stretch", "US"),
  c2("Ohio train derailment cleanup enters new phase", "US"),
  c2("Georgia runoff sets early-vote record", "US"),
  c2("Michigan plant retools for battery production", "US"),
  c2("Arizona water deal averts shortage cuts", "US"),
  c2("Illinois budget stalemate drags on", "US"),
  c2("Virginia schools pilot four-day week", "US"),
  c2("Colorado ski towns fight housing crunch", "US"),
  c2("American Airlines adds transatlantic routes", "US"),
  c2("America's small towns bet on remote workers", "US"),
  c2("Rate cut hopes lift markets", "US", true, {
    description: "Traders on Wall Street bet on a soft landing.",
    providerCountry: "us",
  }),
  c2("United States expands chip export controls", "US"),
  c2("Boston-area storm knocks out power to thousands", "US"),
  c2("Wall Street bonuses climb despite deal slump", "US"),
  c2("White House hosts mayors for infrastructure summit", "US"),
  c2("Senate filibuster fight returns", "US"),
  c2("Congress weighs farm bill extension", "US"),
  c2("Pentagon audit flags spare-parts shortfall", "US"),
  c2("FBI and Homeland Security warn of holiday scams", "US"),
  c2("Supreme Court declines election case", "US"),
  c2("Federal Reserve minutes show divided committee", "US"),
  c2("Texas and Arizona spar over water rights", "US"),
  c2("California ballot measure targets gig work", "US"),
  c2("New York rent board approves increase", "US"),
  c2("Chicago transit faces fiscal cliff", "US"),
  c2("Seattle port workers ratify contract", "US"),
  c2("Atlanta braces for playoff weekend crowds", "US"),
  c2("Houston energy corridor adds jobs", "US"),
  c2("Philadelphia schools reopen after strike", "US"),
  c2("Michigan voters weigh term limits", "US"),
  c2("Virginia governor's race tightens", "US"),
  c2("Colorado river states near usage pact", "US"),
  c2("IRS free-file program expands", "US"),
];

const GEO_CA: GeographyFixture[] = [
  c2("Bank of Canada signals cautious approach ahead of rate decision", "CA"),
  c2("Ottawa unveils dental care expansion", "CA"),
  c2("Toronto housing market shows signs of cooling", "CA"),
  c2("Vancouver port strike disrupts shipping", "CA"),
  c2("Montreal festival season draws record crowds", "CA"),
  c2("Calgary energy firms report strong quarter", "CA"),
  c2("Edmonton city council debates transit fare freeze", "CA"),
  c2("Winnipeg lab earns infectious disease upgrade", "CA"),
  c2("Quebec tables secularism bill amendments", "CA"),
  c2("Ontario premier announces new highway funding", "CA"),
  c2("Alberta oil sands output hits record", "CA"),
  c2("British Columbia wildfire season starts early", "CA"),
  c2("Manitoba floodway spares communities again", "CA"),
  c2("Saskatchewan potash exports climb", "CA"),
  c2("Nova Scotia fishery dispute escalates", "CA"),
  c2("New Brunswick immersion program overhaul paused", "CA"),
  c2("Newfoundland offshore wind project advances", "CA"),
  c2("Prince Edward Island tourism rebounds", "CA"),
  c2("Yukon mining review tightens rules", "CA"),
  c2("Nunavut housing crisis draws federal pledge", "CA"),
  c2("Northwest Territories diamond mine extends life", "CA"),
  c2("Parliament Hill security review ordered", "CA"),
  c2("Trudeau-era policies face review", "CA"),
  c2("Carney government unveils first budget", "CA"),
  c2("RCMP probes money laundering network", "CA"),
  c2("CBC faces funding shakeup", "CA"),
  c2("NDP pushes pharmacare in confidence talks", "CA"),
  c2("Bloc Québécois gains in new poll", "CA"),
  c2("First Nations leaders meet on child welfare reform", "CA"),
  c2("Métis nation signs self-government accord", "CA"),
  c2("Inuit communities push for housing funds", "CA"),
  c2("Grey Cup festivities take over host city", "CA"),
  c2("TSX rallies on energy strength", "CA"),
  c2("Health Canada approves new RSV vaccine", "CA"),
  c2("Statistics Canada reports flat retail sales", "CA"),
  c2("Bay Street eyes rate decision", "CA"),
  c2("Loonie slips against the greenback", "CA"),
  c2("Hydro-Québec plans grid expansion", "CA"),
  c2("Via Rail adds corridor departures", "CA"),
  c2("Canada Post proposes weekend parcel delivery", "CA"),
  c2("Governor general presides over citizenship ceremony", "CA"),
  c2("Canadian dairy farmers protest trade concessions", "CA"),
  c2("Canadians brace for winter storm sweeping the prairies", "CA"),
  c2("Canada expands immigration targets", "CA"),
  c2("Canadian retailers brace for holiday season", "CA"),
  c2("Ottawa and provinces spar over health transfers", "CA"),
  c2("Toronto film festival unveils lineup", "CA"),
  c2("Vancouver rain records fall again", "CA"),
  c2("Montreal metro extension opens", "CA"),
  c2("Calgary Stampede sets attendance record", "CA"),
  c2("Quebec language law faces court challenge", "CA"),
  c2("Ontario teachers reach tentative deal", "CA"),
  c2("Alberta budget bets on resource revenue", "CA"),
  c2("British Columbia port congestion eases", "CA"),
  c2("Saskatchewan crop report points to bumper year", "CA"),
  c2("Manitoba byelection tests government support", "CA"),
  c2("Nova Scotia storm cleanup continues", "CA"),
  c2("Newfoundland cod fishery reopens", "CA"),
  c2("Yukon gold rush history draws tourists", "CA"),
  c2("RCMP recruit numbers rebound", "CA"),
  c2("Trudeau memoir tops bestseller list", "CA"),
  c2("Carney defends fiscal update in question period", "CA"),
  c2("Bank of Canada rate decision looms", "CA"),
  c2("Health Canada reviews food labelling rules", "CA"),
  c2("Statistics Canada says population tops 42 million", "CA"),
  c2("Grey Cup halftime act announced", "CA"),
  c2("TSX tech listings hit new high", "CA"),
  c2("Loonie rallies on jobs data", "CA"),
  c2("Via Rail strike averted at last minute", "CA"),
  c2("Canada Post backlog clears after holiday crush", "CA"),
  c2("First Nations water advisories decline", "CA"),
  c2("Inuit art exhibit tours the country", "CA"),
  c2("Premier calls snap provincial election", "CA"),
  c2("Housing starts slump in Toronto suburbs", "CA", true, {
    providerCountry: "ca",
  }),
  c2("Governor general's literary awards announced", "CA"),
];

const GEO_US_CA: GeographyFixture[] = [
  c2("US and Canada resume talks on softwood lumber trade dispute", "US_CA"),
  c2("Washington and Ottawa align on critical minerals strategy", "US_CA"),
  c2("New border crossing links Detroit with Windsor, Ontario", "US_CA"),
  c2("Seattle and Vancouver pitch joint World Cup fan zones", "US_CA"),
  c2("US tariffs on Canadian steel draw retaliation threat", "US_CA"),
  c2("California wildfire smoke drifts into British Columbia", "US_CA"),
  c2("Canada and United States expand Arctic patrols", "US_CA"),
  c2("New York and Toronto exchanges explore dual listings", "US_CA"),
  c2("Maple Leafs stun Boston with third-period comeback", "US_CA"),
  c2("Toronto Blue Jays open series in New York", "US_CA"),
  c2("Canadian snowbirds face new US entry rules", "US_CA"),
  c2("Ontario shoppers cross into New York for holiday deals", "US_CA"),
  c2("Yukon and Washington state sign wildfire aid pact", "US_CA"),
  c2("Great Lakes cleanup funded by Ottawa and Washington", "US_CA"),
  c2("Vancouver and Seattle high-speed rail study advances", "US_CA"),
  c2("Bills fans from Ontario pack New York stadium", "US_CA"),
  c2("Michigan and Ontario automakers share battery supply chains", "US_CA"),
  c2("US border officers and RCMP bust smuggling ring", "US_CA"),
  c2("Trump and Carney spar over dairy tariffs", "US_CA"),
  c2("Biden-era pipeline decision still irks Alberta", "US_CA"),
  c2("Quebec hydro exports power New York grid", "US_CA"),
  c2("Montreal and Boston universities launch joint AI lab", "US_CA"),
  c2("Calgary and Houston energy firms swap carbon tech", "US_CA"),
  c2("Winnipeg lab joins CDC flu surveillance network", "US_CA"),
  c2("Toronto crowd sees Raptors edge Chicago", "US_CA"),
  c2("Cross-border tourism rebounds between Vancouver and Seattle", "US_CA"),
  c2("US Thanksgiving shoppers hit Canadian outlet malls", "US_CA"),
  c2("Federal Reserve and Bank of Canada diverge on rates", "US_CA"),
  c2("Pacific Northwest quake drill spans Washington and British Columbia", "US_CA"),
  c2("NHL expansion talk links Atlanta and Quebec City", "US_CA"),
];

const GEO_GLOBAL_NA: GeographyFixture[] = [
  c2("NATO members plan joint exercise amid supply chain concerns", "GLOBAL_NA"),
  c2("G7 finance chiefs weigh coordinated response to debt distress", "GLOBAL_NA"),
  c2("G20 summit ends without joint communiqué", "GLOBAL_NA"),
  c2("North America braces for another record heat season", "GLOBAL_NA"),
  c2("USMCA review puts auto content rules in spotlight", "GLOBAL_NA"),
  c2("NAFTA-era steel disputes resurface at trade panel", "GLOBAL_NA"),
  c2("Trade war fears rattle global markets", "GLOBAL_NA"),
  c2("Tariff threats loom over auto supply chain", "GLOBAL_NA"),
  c2("Border wait times spike during holiday rush", "GLOBAL_NA"),
  c2("Arctic shipping lanes see record traffic", "GLOBAL_NA"),
  c2("NORAD tracks high-altitude balloon over the north", "GLOBAL_NA"),
  c2("Oil prices whipsaw on supply fears", "GLOBAL_NA"),
  c2("Supply chain snarls ease at major ports", "GLOBAL_NA"),
  c2("World trade volumes recover slowly, agency says", "GLOBAL_NA"),
  c2("OPEC extends production cuts into next year", "GLOBAL_NA"),
  c2("G7 leaders agree on code of conduct for military AI", "GLOBAL_NA"),
  c2("NATO expands air policing mission", "GLOBAL_NA"),
  c2("Tariffs on solar imports set to expire", "GLOBAL_NA"),
  c2("Global markets slide as bond yields jump", "GLOBAL_NA"),
  c2("North America's power grids warn of winter strain", "GLOBAL_NA"),
  c2("G20 energy ministers debate methane pledge", "GLOBAL_NA"),
  c2("Arctic council resumes limited cooperation", "GLOBAL_NA"),
  c2("NORAD holiday tracker goes live", "GLOBAL_NA"),
  c2("World trade body warns of fragmentation", "GLOBAL_NA"),
  c2("Oil prices dip as demand outlook softens", "GLOBAL_NA"),
];

const GEO_GLOBAL: GeographyFixture[] = [
  // audit: was classified CA. Title alone, with a typical Premier League
  // description, and served through the GNews country=ca feed — all GLOBAL.
  c2("Transfer rumors, news: Arsenal hold talks over Osimhen deal", "GLOBAL"),
  c2("Transfer rumors, news: Arsenal hold talks over Osimhen deal", "GLOBAL", true, {
    description:
      "The latest Premier League transfer news, with clubs across Europe chasing summer deals.",
  }),
  c2("Transfer rumors, news: Arsenal hold talks over Osimhen deal", "GLOBAL", true, {
    providerCountry: "ca",
  }),
  c2("Transfer rumors, news: Arsenal hold talks over Osimhen deal", "GLOBAL", true, {
    description:
      "The latest Premier League transfer news, with clubs across Europe chasing summer deals.",
    providerCountry: "ca",
    sourceCountry: "US",
  }),
  c2("Premier League title race tightens as Arsenal beat Chelsea", "GLOBAL"),
  c2("Manchester United appoint new manager after cup exit", "GLOBAL"),
  c2("Prime minister faces questions in the Commons over budget", "GLOBAL"),
  c2("UK prime minister shuffles cabinet after resignations", "GLOBAL"),
  c2("France and Germany clash over fiscal rules", "GLOBAL"),
  c2("Japan's economy slips into technical recession", "GLOBAL"),
  c2("India launches lunar probe on heavy rocket", "GLOBAL"),
  c2("Brazil floods displace thousands in the south", "GLOBAL"),
  c2("Australia bans social media for under-16s", "GLOBAL"),
  c2("South America trade bloc courts new members", "GLOBAL"),
  c2("Latin America startups draw record funding", "GLOBAL"),
  c2("European Central Bank holds rates steady", "GLOBAL"),
  c2("China's exports beat forecasts despite curbs", "GLOBAL"),
  c2("Nigeria's vultures are disappearing and scientists are worried", "GLOBAL"),
  c2("Kenya's marathoners sweep podium in Berlin", "GLOBAL"),
  c2("Champions League final heads to penalties", "GLOBAL"),
  c2("Bank of England cuts rates for first time in years", "GLOBAL"),
  c2("German chancellor calls confidence vote", "GLOBAL"),
  c2("Officials take cautious tone as central bank tells us little", "GLOBAL"),
  c2("Volcano eruption disrupts flights across the region", "GLOBAL", true, {
    providerCountry: "us",
  }),
  c2("Global shipping giant reports record year", "GLOBAL", true, {
    sourceCountry: "CA",
  }),
  c2("Premiership rugby expands playoff format", "GLOBAL"),
  // Known-hard: "premier" as a foreign head of government.
  c2("Chinese premier meets EU officials in Brussels", "GLOBAL", false),
  c2("Antarctic expedition sets sail from Hobart", "GLOBAL"),
  c2("Eurozone inflation eases to two-year low", "GLOBAL"),
  c2("Middle East peace talks resume in Cairo", "GLOBAL"),
  c2("Red Sea shipping attacks continue despite patrols", "GLOBAL"),
  c2("African Union condemns coup in Sahel state", "GLOBAL"),
  c2("Pacific islands summit tackles rising seas", "GLOBAL"),
  c2("South Korea's chipmakers boost output", "GLOBAL"),
  c2("Russia extends grain export ban", "GLOBAL"),
  c2("Ukraine peace framework gains cautious support", "GLOBAL"),
  c2("Spain's tourism boom strains housing supply", "GLOBAL"),
  c2("Italy's coalition survives budget vote", "GLOBAL"),
  c2("Dutch government collapses over migration policy", "GLOBAL"),
  c2("Swiss glaciers shrink to record lows", "GLOBAL"),
  c2("Egypt unveils new museum wing", "GLOBAL"),
  c2("Argentina's inflation slows for fourth month", "GLOBAL"),
  c2("Nordic countries deepen defence ties", "GLOBAL"),
  c2("Serie A title race goes to the final day", "GLOBAL"),
  c2("Bundesliga club sacks coach after slump", "GLOBAL"),
  c2("Cricket world cup sets attendance record", "GLOBAL"),
  c2("Formula 1 adds new night race", "GLOBAL"),
  c2("Wimbledon expands grounds after long planning fight", "GLOBAL"),
  c2("Olympics organizers unveil athletes' village plans", "GLOBAL"),
  c2("Transfer window shuts across Europe's top leagues", "GLOBAL"),
  // Known-hard: Georgia the country vs Georgia the US state.
  c2("Protesters fill the streets of Georgia's capital Tbilisi", "GLOBAL", false),
];

export const geographyFixtures: GeographyFixture[] = [
  ...GEO_US,
  ...GEO_CA,
  ...GEO_US_CA,
  ...GEO_GLOBAL_NA,
  ...GEO_GLOBAL,
];

// Helper alias so geography rows read like the category rows above.
function c2(
  title: string,
  expectedGeography: Country,
  highConfidence = true,
  extra: Partial<GeographyFixture> = {},
): GeographyFixture {
  return { title, expectedGeography, highConfidence, ...extra };
}

// ─────────────────────────── Content type ───────────────────────────

export interface ContentTypeFixture {
  title: string;
  description?: string;
  expectedContentType: ContentType;
  highConfidence: boolean;
}

const ct = (
  title: string,
  expectedContentType: ContentType,
  highConfidence = true,
  description?: string,
): ContentTypeFixture => ({
  title,
  expectedContentType,
  highConfidence,
  ...(description ? { description } : {}),
});

/**
 * Synthetic-but-realistic labeled examples for the content-type classifier.
 * The one verbatim headline ("I'm a neuroscientist…") is a short audit
 * example explicitly kept as a regression input.
 */
export const contentTypeFixtures: ContentTypeFixture[] = [
  // ── press_release: wire markers in the dek ──────────────────────────
  ct("Northglen Mining Announces Filing of Technical Report", "press_release", true,
    "VANCOUVER, British Columbia (GLOBE NEWSWIRE) — Northglen Mining today announced the filing of a technical report."),
  ct("Lakefront Software Expands Board of Directors", "press_release", true,
    "TORONTO, Aug. 12 /PR Newswire/ — Lakefront Software announced two new board appointments."),
  ct("Harborline Logistics Opens Distribution Hub", "press_release", true,
    "CHICAGO (Business Wire) — Harborline Logistics today opened a new regional distribution hub."),
  ct("Cedarpoint Resources Provides Exploration Update", "press_release", true,
    "CALGARY, Alberta (Newsfile Corp.) — Cedarpoint Resources provided an update on its summer program."),
  ct("Brightfield Energy Signs Supply Agreement", "press_release", true,
    "AUSTIN, Texas (ACCESSWIRE) — Brightfield Energy signed a multi-year supply agreement."),
  ct("Statement From Ridgeline Foods on Product Recall", "press_release", true,
    "For immediate release: Ridgeline Foods is voluntarily recalling one lot of packaged snacks."),
  // ── press_release: headline verbs alone ─────────────────────────────
  ct("Maplecore Capital Announces Q2 2026 Financial Results", "press_release"),
  ct("Sablewood Metals Reports Second Quarter 2026 Results", "press_release"),
  ct("Northbay Uranium Announces Grant of Stock Options", "press_release"),
  ct("Ferngrove Holdings Renews Normal Course Issuer Bid", "press_release"),
  ct("Crestline Minerals Completes Private Placement", "press_release"),
  ct("Bluewater REIT Declares Quarterly Cash Dividend", "press_release"),
  ct("Ironvale Copper Announces Closing of Bought-Deal Offering", "press_release"),
  ct("Summitpeak Gold Announces Pricing of Public Offering", "press_release"),
  ct("Quarrystone Resources Reports Q1 2026 Earnings", "press_release"),
  ct("Westerly Pipelines Declares Monthly Distribution", "press_release"),
  // ── press_release: securities-lawsuit spam boilerplate ──────────────
  ct("SHAREHOLDER ALERT: Kessler Topaz Reminds Investors of Deadline in Nortech Case", "press_release"),
  ct("Investor Notice: Rosen Law Encourages Vantage Metals Holders to Secure Counsel", "press_release"),
  ct("Pomerantz Law Reminds Shareholders of Lead Plaintiff Deadline in Clearway Suit", "press_release"),
  // ── press_release: ticker + weak verb ───────────────────────────────
  ct("Glacier Peak Mining (TSX: FAKE) Announces Drill Results", "press_release"),
  ct("Redwood Robotics (NASDAQ: DEMO) Appoints New Chief Financial Officer", "press_release"),
  ct("Harborview Bancorp (NYSE: NONE) Completes Branch Acquisition", "press_release"),
  ct("Tundra Lithium (TSXV: NADA) Provides Corporate Update", "press_release"),
  // ── opinion: byline pipe ────────────────────────────────────────────
  ct("I'm a neuroscientist. Here's why our brains need pop concerts | Bala Subramaniam", "opinion"),
  ct("The case for four-day school weeks has never been stronger | Dana Whitfield", "opinion"),
  ct("Our cities were built for cars. They must be rebuilt for people | Miguel Arroyo", "opinion"),
  ct("Austerity is a choice, and voters know it | Priya Raghavan", "opinion"),
  // ── opinion: prefixes and first-person openers ──────────────────────
  ct("Opinion: The grid can't wait for the perfect climate bill", "opinion"),
  ct("Comment: What the housing debate keeps getting wrong", "opinion"),
  ct("I'm a paramedic. The ER crisis looks different from the inside", "opinion"),
  ct("Why I stopped letting my kids use tablets at dinner", "opinion"),
  ct("How I learned to love my tiny apartment kitchen", "opinion"),
  ct("I was wrongfully convicted. Here's what juries should know", "opinion"),
  // ── analysis ────────────────────────────────────────────────────────
  ct("Analysis: Why the central bank is boxed in on rates", "analysis"),
  ct("Explainer: How the new tariff schedule actually works", "analysis"),
  ct("What to know about the measles outbreak in the Prairies", "analysis"),
  ct("Analysis: The quiet redistricting fight that could decide the House", "analysis"),
  ct("What to know about Friday's transit strike deadline", "analysis"),
  // ── live ────────────────────────────────────────────────────────────
  ct("Live: Hurricane nears the Gulf Coast as evacuations begin", "live"),
  ct("Election night live updates: polls close in six states", "live"),
  ct("Wildfire evacuation orders expand — follow our live blog", "live"),
  // ── news: must NOT be mislabeled (hard negatives) ───────────────────
  ct("Apple announces new iPhone lineup at fall event", "news"),
  ct("Mayor announces plan to expand transit service to the airport", "news"),
  ct("Government reports slower job growth in July", "news"),
  ct("Police report suspect in custody after downtown standoff", "news"),
  ct("Senate passes stopgap funding bill hours before deadline", "news"),
  ct("Automaker completes recall of 40,000 pickup trucks", "news"),
  ct("Storm knocks out power to thousands across the region", "news"),
  ct("Scientists report progress on malaria vaccine trial", "news"),
  ct("City council approves budget after marathon session", "news"),
  ct("Chipmaker's profits surge on data-center demand", "news"),
  ct("Regulator fines telecom giant over billing practices", "news"),
  ct("Manchester derby ends level as title race tightens | Premier League", "news"),
  ct("New training facility opens for national ski team | CBC Sports", "news"),
  ct("Wildfire smoke prompts air quality advisories across the province", "news"),
  ct("Ottawa unveils details of dental care expansion", "news"),
  ct("Jury begins deliberations in fraud trial of former executive", "news"),
  ct("Bank of Canada holds key rate steady at 2.75%", "news"),
  ct("Housing starts fell 4% in July, national agency says", "news"),
  ct("Astronomers spot record-breaking fast radio burst", "news"),
  ct("Ferry service resumes after mechanical inspection", "news"),
  ct("Transit agency reports ridership back to pre-pandemic levels", "news"),
  ct("Premier announces cabinet shuffle after minister resigns", "news"),
  ct("Drought forces ranchers to sell cattle herds early", "news"),
  // Known-hard: earnings JOURNALISM about a company (not the issuer's own
  // release) still reads like a release headline — accepted ambiguity.
  ct("Retail giant reports strong quarter as shoppers return", "news", false),
];
