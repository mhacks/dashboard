import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

function SectionSkeleton({ fields = 3 }: { fields?: number }) {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-48" />
      </CardHeader>
      <CardContent className="space-y-4">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function ApplicationFormSkeleton() {
  return (
    <div className="container mx-auto max-w-3xl py-8">
      {/* Header */}
      <div className="mb-8 text-center space-y-2">
        <Skeleton className="h-9 w-56 mx-auto" />
        <Skeleton className="h-4 w-72 mx-auto" />
      </div>

      <div className="space-y-8">
        {/* Personal Information */}
        <SectionSkeleton fields={4} />

        {/* Academic Information */}
        <SectionSkeleton fields={5} />

        {/* Essays */}
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-24" />
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-28 w-full" />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Logistics */}
        <SectionSkeleton fields={4} />

        {/* Socials */}
        <SectionSkeleton fields={3} />

        {/* Communications */}
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-36" />
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-4 w-64" />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* MLH & Sponsor Agreements */}
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-52" />
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-start gap-2">
                <Skeleton className="h-4 w-4 mt-0.5 rounded flex-shrink-0" />
                <Skeleton className="h-4 w-full" />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Action buttons */}
        <div className="flex justify-end gap-4">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-10 w-40" />
        </div>
      </div>
    </div>
  );
}
