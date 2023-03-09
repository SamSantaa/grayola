import { use } from 'react';
import { notFound, redirect } from 'next/navigation';

import If from '~/core/ui/If';
import Heading from '~/core/ui/Heading';
import Trans from '~/core/ui/Trans';

import getLogger from '~/core/logger';
import getSupabaseServerClient from '~/core/supabase/server-client';

import { getMembershipByInviteCode } from '~/lib/memberships/queries';
import ExistingUserInviteForm from '~/app/invite/components/ExistingUserInviteForm';
import NewUserInviteForm from '~/app/invite/components/NewUserInviteForm';
import I18nProvider from '~/i18n/I18nProvider';
import initializeServerI18n from '~/i18n/i18n.server';
import getLanguageCookie from '~/i18n/get-language-cookie';

interface Context {
  params: {
    code: string;
  };
}

export const metadata = {
  title: `Join Organization`,
};

const InvitePage = ({ params }: Context) => {
  const data = use(loadInviteData(params.code));

  if ('redirect' in data) {
    return redirect(data.destination);
  }

  const organization = data.membership.organization;

  return (
    <I18nProvider lang={data.language}>
      <Heading type={4}>
        <Trans
          i18nKey={'auth:joinOrganizationHeading'}
          values={{
            organization: organization.name,
          }}
        />
      </Heading>

      <div>
        <p className={'text-center'}>
          <Trans
            i18nKey={'auth:joinOrganizationSubHeading'}
            values={{
              organization: organization.name,
            }}
            components={{ b: <b /> }}
          />
        </p>

        <p className={'text-center'}>
          <If condition={!data.user}>
            <Trans i18nKey={'auth:signUpToAcceptInvite'} />
          </If>
        </p>
      </div>

      <If condition={data.user} fallback={<NewUserInviteForm />}>
        {(user) => <ExistingUserInviteForm user={user} />}
      </If>
    </I18nProvider>
  );
};

export default InvitePage;

async function loadInviteData(code: string) {
  const logger = getLogger();

  // we use an admin client to be able to read the pending membership
  const adminClient = getSupabaseServerClient({ admin: true });

  try {
    const { data: membership, error } = await getMembershipByInviteCode<{
      id: number;
      code: string;
      organization: {
        name: string;
        id: number;
      };
    }>(adminClient, {
      code,
      query: `
        id,
        code,
        organization: organization_id (
          name,
          id
        )
      `,
    });

    // if the invite wasn't found, it's 404
    if (error) {
      logger.warn(
        {
          code,
        },
        `User navigated to invite page, but it wasn't found. Redirecting to home page...`
      );

      return notFound();
    }

    const { data: userSession } = await adminClient.auth.getSession();
    const user = userSession?.session?.user;

    const { language } = await initializeServerI18n(getLanguageCookie());

    return {
      user,
      membership,
      code,
      language,
    };
  } catch (error) {
    logger.error(
      error,
      `Error encountered while fetching invite. Redirecting to home page...`
    );

    return redirectTo('/');
  }
}

function redirectTo(destination: string) {
  return {
    redirect: true,
    destination: destination,
  };
}
