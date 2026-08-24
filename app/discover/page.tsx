import { getTopPerformers, getHomepageDiscover, topByCategory } from "@/lib/analytics/scoring/repository";
import { DiscoverExplorer } from "@/components/discover/discover-explorer";

export const revalidate = 300;

const DISCOVER_PAGE_COUNT = 12;

export default async function DiscoverPage() {
  const [{ players }, discover] = await Promise.all([
    getTopPerformers(),
    getHomepageDiscover(DISCOVER_PAGE_COUNT),
  ]);

  const categories = {
    ...discover,
    creators: topByCategory(players, "creation", DISCOVER_PAGE_COUNT),
    defenders: topByCategory(players, "defence", DISCOVER_PAGE_COUNT),
  };

  return <DiscoverExplorer categories={categories} players={players} />;
}
