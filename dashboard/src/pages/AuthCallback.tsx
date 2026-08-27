import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { Spinner } from "../components/ui/Feedback";
import { useAuth } from "../context/AuthContext";

/**
 * Landing route the bot redirects to after the Twitch OAuth round trip.
 * It stores the signed session and forwards to the dashboard.
 */
export function AuthCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { acceptToken } = useAuth();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const token = params.get("token");
    const denied = params.get("denied");

    if (denied) {
      navigate("/login?denied=1", { replace: true });
      return;
    }

    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    acceptToken(token).then(() => navigate("/", { replace: true }));
  }, [params, navigate, acceptToken]);

  return (
    <div className="grid min-h-screen place-items-center bg-canvas">
      <Spinner />
    </div>
  );
}
