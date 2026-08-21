import { createHubPage } from "@/components/hubs/HubPage";

// Topic hub — see config/hubs.ts. ISR like every section page.
export const revalidate = 300;

const hub = createHubPage("money");
export const generateMetadata = hub.generateMetadata;
export default hub.Page;
