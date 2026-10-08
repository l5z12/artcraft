import { authentication } from "./authentication";
import { UsersApi } from "~/Classes/ApiManager/UsersApi";
import { BillingApi } from "~/Classes/ApiManager/BillingApi";
import { gtagLogin, gtagLogout } from "@storyteller/google-analytics";

import {
  updateActiveSubscriptions,
  updateAuthStatus,
  updateUserInfo,
  setLogoutStates,
} from "./utilities";
import { AUTH_STATUS } from "~/enums";

export const logout = async (
  failureCallback?: (errorMessage: string) => void,
) => {
  const usersApi = new UsersApi();
  const logoutResponse = await usersApi.Logout();
  if (!logoutResponse.success && failureCallback) {
    failureCallback(
      logoutResponse.errorMessage || "Unknown Error during Destroy Session",
    );
  }
  // if success, nothing
  // regarldess of success/fail, clear the state and localstorage
  setLogoutStates();
  gtagLogout();
};

export const login = async ({
  usernameOrEmail,
  password,
}: {
  usernameOrEmail: string;
  password: string;
  failureCallback?: () => void;
}) => {
  updateAuthStatus(AUTH_STATUS.LOGGING);

  const usersApi = new UsersApi();
  const loginResponse = await usersApi.Login({ usernameOrEmail, password });
  if (!loginResponse.success || !loginResponse.data) {
    setLogoutStates();
    return;
  }

  // Restore account details; subscriptions are optional.
  getUserInfoAndSubcriptions();

  window.location.href = "/"; // TODO(bt,2025-04-19): Once we have in-page routing, get rid of this.
};

export const signUp = async ({
  username,
  email,
  password,
  passwordConfirmation,
  signupSource,
}: {
  username: string;
  email: string;
  password: string;
  passwordConfirmation: string;
  signupSource?: string;
}) => {
  updateAuthStatus(AUTH_STATUS.LOGGING);

  console.log(">>> Signup with source: ", signupSource);

  const usersApi = new UsersApi();
  const response = await usersApi.Signup({
    email,
    password,
    passwordConfirmation,
    username,
    signupSource,
  });
  console.log(response);
  if (!response.success || !response.data) {
    setLogoutStates();
    return response.errorMessage ?? "Unknown error";
  }

  // Restore account details; subscriptions are optional.
  getUserInfoAndSubcriptions();
  return "";
};

export const persistLogin = async () => {
  //Only run First Load, return if not
  if (authentication.status.value !== AUTH_STATUS.INIT) {
    return;
  }
  await getUserInfoAndSubcriptions();
};

// NB: Only for SyncStorytellerApiConfig.
export const forceGetUserInfoAndSubcriptions = async () => {
  await getUserInfoAndSubcriptions();
};

async function getUserInfoAndSubcriptions() {
  console.log('getUserInfoAndSubcriptions()')
  updateAuthStatus(AUTH_STATUS.GET_USER_INFO);
  const usersApi = new UsersApi();
  const sessionResponse = await usersApi.GetSession();
  if (
    !sessionResponse.success ||
    !sessionResponse.data ||
    !sessionResponse.data.user
  ) {
    setLogoutStates();
    return;
  }

  updateUserInfo(sessionResponse.data.user);
  updateAuthStatus(AUTH_STATUS.LOGGED_IN);

  const userToken = sessionResponse.data.user.user_token;
  if (!!userToken) {
    gtagLogin(userToken);
  }

  try {
    const billingApi = new BillingApi();
    const subscriptionsResponse = await billingApi.ListActiveSubscriptions();
    // Ignore a response that arrived after logout or an account switch.
    if (authentication.userInfo.value?.user_token !== userToken) return;
    updateActiveSubscriptions({
      maybe_loyalty_program: subscriptionsResponse.data?.maybe_loyalty_program,
      active_subscriptions: subscriptionsResponse.data?.active_subscriptions || [],
    });
  } catch (error) {
    console.error("Unable to refresh optional subscriptions", error);
  }
}
