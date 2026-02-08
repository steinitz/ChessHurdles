import { adminClient } from "better-auth/client/plugins";
import { oneTimeTokenClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { clientEnv } from "./env";

const getBaseUrl = () => {
  const configuredUrl = clientEnv.BETTER_AUTH_BASE_URL;
  if (typeof window !== "undefined" && configuredUrl.includes("localhost") && window.location.hostname !== "localhost") {
    // We are likely on a LAN device (iPad) accessing the dev server via IP.
    // The configured 'localhost' won't work. Use the current origin.
    return window.location.origin;
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
