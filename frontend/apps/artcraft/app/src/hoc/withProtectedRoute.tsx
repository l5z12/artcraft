import { ComponentType, useEffect } from "react";
import { persistLogin } from "~/signals";

export const withProtectionRoute = <P extends object>(
  Component: ComponentType<P>,
) =>
  function ProtectionRoute(rest: P) {
    // Session restoration never blocks access to the desktop tools.
    useEffect(() => {
      void persistLogin();
    }, []);

    return <Component {...rest} />;
  };
