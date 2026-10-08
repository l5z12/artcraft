import { beforeEach, expect, it, vi } from "vitest";
import { persistLogin } from "./fetchers";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  subscriptions: vi.fn(),
  logout: vi.fn(),
  activeSubscriptions: vi.fn(),
  authentication: {
    status: { value: "INIT" },
    userInfo: { value: undefined as { user_token: string } | undefined },
  },
}));

vi.mock("./authentication", () => ({ authentication: mocks.authentication }));
vi.mock("~/Classes/ApiManager/UsersApi", () => ({
  UsersApi: class { GetSession = mocks.session; },
}));
vi.mock("~/Classes/ApiManager/BillingApi", () => ({
  BillingApi: class { ListActiveSubscriptions = mocks.subscriptions; },
}));
vi.mock("@storyteller/google-analytics", () => ({ gtagLogin: vi.fn(), gtagLogout: vi.fn() }));
vi.mock("~/enums", () => ({
  AUTH_STATUS: { INIT: "INIT", GET_USER_INFO: "GET_USER_INFO", LOGGED_IN: "LOGGED_IN" },
}));
vi.mock("./utilities", () => ({
  updateAuthStatus: (status: string) => { mocks.authentication.status.value = status; },
  updateUserInfo: (user: { user_token: string }) => { mocks.authentication.userInfo.value = user; },
  updateActiveSubscriptions: mocks.activeSubscriptions,
  setLogoutStates: mocks.logout,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authentication.status.value = "INIT";
  mocks.authentication.userInfo.value = undefined;
  mocks.session.mockResolvedValue({ success: true, data: { user: { user_token: "u_test", can_access_studio: false } } });
  mocks.subscriptions.mockResolvedValue({ success: false });
});

it("restores a free account even without studio access or billing availability", async () => {
  await persistLogin();
  expect(mocks.authentication.status.value).toBe("LOGGED_IN");
  expect(mocks.authentication.userInfo.value?.user_token).toBe("u_test");
  expect(mocks.logout).not.toHaveBeenCalled();
});

it("keeps the account signed in if the optional subscription request throws", async () => {
  mocks.subscriptions.mockRejectedValueOnce(new Error("Billing offline"));
  await persistLogin();
  expect(mocks.authentication.status.value).toBe("LOGGED_IN");
  expect(mocks.logout).not.toHaveBeenCalled();
});

it("does not restore stale subscription details after logout", async () => {
  let finish: (value: unknown) => void = () => {};
  mocks.subscriptions.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  const restore = persistLogin();
  await vi.waitFor(() => expect(mocks.subscriptions).toHaveBeenCalled());
  mocks.authentication.userInfo.value = undefined;
  finish({ success: true, data: { active_subscriptions: ["old account"] } });
  await restore;
  expect(mocks.activeSubscriptions).not.toHaveBeenCalled();
});
