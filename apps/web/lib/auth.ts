import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { admin } from "better-auth/plugins";
import { createDatabase } from "@cogniva/database";
import {
  account,
  session,
  user,
  verification
} from "@cogniva/database/schema";
import { sendAuthEmail } from "./email";

export class AuthConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthConfigurationError";
  }
}

function buildAuth(
  databaseUrl: string,
  baseURL: string,
  secret: string,
  trustedOrigins: string[]
) {
  const { db } = createDatabase(databaseUrl);

  return betterAuth({
    appName: "Cogniva",
    baseURL,
    secret,
    trustedOrigins,
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: { user, session, account, verification },
      transaction: true
    }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      revokeSessionsOnPasswordReset: true,
      resetPasswordTokenExpiresIn: 60 * 60,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      customSyntheticUser: ({ coreFields, additionalFields, id }) => ({
        ...coreFields,
        role: "user",
        banned: false,
        banReason: null,
        banExpires: null,
        ...additionalFields,
        id
      }),
      sendResetPassword: async ({ user: authUser, url }) => {
        await sendAuthEmail({
          to: authUser.email,
          subject: "Reset your Cogniva password",
          title: "Reset your password",
          message:
            "A password reset was requested for your Cogniva account. Use the link below to choose a new password.",
          actionUrl: url,
          actionLabel: "Reset password"
        });
      }
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: false,
      expiresIn: 60 * 60,
      sendVerificationEmail: async ({ user: authUser, url }) => {
        await sendAuthEmail({
          to: authUser.email,
          subject: "Verify your Cogniva email address",
          title: "Verify your email address",
          message:
            "Confirm your email address to finish setting up your Cogniva account.",
          actionUrl: url,
          actionLabel: "Verify email"
        });
      }
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24
    },
    plugins: [
      admin({
        defaultRole: "user",
        adminRoles: ["admin"]
      })
    ]
  });
}

type CognivaAuth = ReturnType<typeof buildAuth>;
let authInstance: CognivaAuth | undefined;

function requireEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new AuthConfigurationError(
      `Authentication is not ready: ${name} has not been configured.`
    );
  }
  return value;
}

export function getAuth(): CognivaAuth {
  if (authInstance) return authInstance;

  const databaseUrl = requireEnvironment("DATABASE_URL");
  const baseURL = requireEnvironment("BETTER_AUTH_URL");
  const secret = requireEnvironment("BETTER_AUTH_SECRET");

  if (secret.length < 32) {
    throw new AuthConfigurationError(
      "BETTER_AUTH_SECRET must contain at least 32 characters of high-entropy random data."
    );
  }

  let parsedBaseURL: URL;
  try {
    parsedBaseURL = new URL(baseURL);
  } catch {
    throw new AuthConfigurationError(
      "BETTER_AUTH_URL must be a valid absolute URL."
    );
  }

  if (
    process.env.NODE_ENV === "production" &&
    parsedBaseURL.protocol !== "https:"
  ) {
    throw new AuthConfigurationError(
      "BETTER_AUTH_URL must use HTTPS in production."
    );
  }

  const from = process.env.RESEND_FROM_EMAIL?.trim();
  const resendKey = process.env.RESEND_API_KEY?.trim();
  if (!from || !resendKey) {
    throw new AuthConfigurationError(
      "Authentication is not ready: configure RESEND_API_KEY and RESEND_FROM_EMAIL before enabling account registration."
    );
  }

  const trustedOrigins = (
    process.env.AUTH_TRUSTED_ORIGINS ?? baseURL
  )
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  const instance = buildAuth(databaseUrl, baseURL, secret, trustedOrigins);
  authInstance = instance;
  return instance;
}
