import type { Locale } from "../config";
import { en } from "./en";
import { fr, type ErrorCode, type Messages } from "./fr";

export type { ErrorCode, Messages };

export const messages: Record<Locale, Messages> = { fr, en };
