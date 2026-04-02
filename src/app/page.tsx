import { scanClaudeConfig } from "@/lib/scanner";
import { buildSphereData } from "@/lib/sphereData";
import { SphereView } from "@/components/SphereView";

export default async function OverviewPage() {
  const config = await scanClaudeConfig();
  const sphereData = buildSphereData(config);

  return (
    <div className="h-full flex flex-col">
      <p className="text-sm text-text-muted px-6 pt-4 pb-2 shrink-0">
        Click a project to explore. Click the background to zoom out.
      </p>
      <div className="flex-1 min-h-0 relative">
        <SphereView data={sphereData} />
      </div>
    </div>
  );
}
