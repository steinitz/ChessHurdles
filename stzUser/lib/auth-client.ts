import { adminClient } from "better-auth/client/plugins";
import { oneTimeTokenClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { clientEnv } from "./env";

const getBaseUrl = () => {
  const configuredUrl = clientEnv.BETTER_AUTH_BASE_URL;
  if (typeof window !== "undefined") {
    // If we are on the same hostname as configured (e.g. localhost), use the browser's origin.
    // This fixes Mixed Content issues where config is 'http' but we are serving 'https'.
    try {
      const conf = new URL(configuredUrl);
      if (conf.hostname === window.location.hostname) {
        return window.location.origin;
      }
    } catch {
      // ignore invalid URLs in config
    }

    // Also handle the LAN case (configured=localhost, actual=IP)
    if (configuredUrl.includes("localhost") && window.location.hostname !== "localhost") {
      return window.location.origin;
    }
  }
  return configuredUrl;
};

export const {
  useSession,
  signIn,
  signOut,
  signUp,
  forgetPassword,
  resetPassword,
  changeEmail,
  changePassword,
  deleteUser,
  sendVerificationEmail,
  admin,
  oneTimeToken,
  verifyEmail,
} =
  createAuthClient({
    baseURL: getBaseUrl(),
    plugins: [
      adminClient(),
      oneTimeTokenClient(),
    ],
  });
