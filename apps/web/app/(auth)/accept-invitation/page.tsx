import { AcceptInvitationForm } from "../../../components/auth/AcceptInvitationForm";

export default async function AcceptInvitationPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md p-8 bg-white rounded-xl border border-gray-200">
        <h1 className="text-2xl font-bold text-gray-900 mb-6 text-center">
          Accepter l&apos;invitation
        </h1>
        <AcceptInvitationForm token={token} />
      </div>
    </div>
  );
}
