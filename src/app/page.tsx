import { scanClaudeConfig } from "@/lib/scanner";
import { buildSphereData } from "@/lib/sphereData";
import { OverviewClient } from "@/components/OverviewClient";

export default async function OverviewPage() {
  const config = await scanClaudeConfig();
  const sphereData = buildSphereData(config);

  return (
    <div className="h-full relative">
      <OverviewClient data={sphereData} />
    </div>
  );
}
