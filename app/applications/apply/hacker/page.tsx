import { Suspense } from "react";
import ApplyPage from "./application-form";
import ApplicationFormSkeleton from "./application-form-skeleton";

export default function ApplicationForm() {
  // TODO Call Auth API to fetch user information
  const profileId: Promise<string> = dataFetchingFunc();

  return (
    <>
      <Suspense fallback={<ApplicationFormSkeleton />}>
        <ApplyPage profileIdPromise={profileId} />
      </Suspense>
    </>
  );
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const dataFetchingFunc = async () => {
  await wait(1500);
  return "";
};
