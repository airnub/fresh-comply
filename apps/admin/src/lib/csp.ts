import { headers } from "next/headers";
import { SECURITY_NONCE_HEADER } from "@airnub/utils/security-headers";

export function getCspNonce(): string | null {
  return headers().get(SECURITY_NONCE_HEADER);
}
