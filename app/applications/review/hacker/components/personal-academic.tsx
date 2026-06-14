import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PersonalAcademic() {
  <Card>
    <CardHeader>
      <CardTitle className="text-base">Personal & Academic</CardTitle>
    </CardHeader>
    <CardContent className="space-y-1.5">
      <InfoRow label="Age" value={selected.age} />
      <InfoRow label="Gender" value={selected.gender} />
      <InfoRow label="Ethnicity" value={selected.ethnicity} />
      <InfoRow label="Country" value={selected.country} />
      <InfoRow label="Graduation Year" value={selected.graduationYear} />
      <InfoRow
        label="Previous Hackathons"
        value={selected.previousHackathons}
      />
    </CardContent>
  </Card>;
}
