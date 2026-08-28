type NODE_ENV_TYPE = "development" | "production" | "staging";

interface iAppConfig {
  NODE_ENV: NODE_ENV_TYPE;
  API_HOST_URL: string;
}

const NODE_ENV: NODE_ENV_TYPE =
  (import.meta.env.VITE_NODE_ENV as NODE_ENV_TYPE) || "production";

const API_HOST_URL = (import.meta.env.VITE_API_HOST_URL as string) || "https://api-pulse.photonlegal.com";

const appConfig: iAppConfig = {
  NODE_ENV,
  API_HOST_URL
};


export default appConfig;