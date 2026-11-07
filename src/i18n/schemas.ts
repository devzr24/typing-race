import { z } from "zod";
import { LOCALES, THEMES } from "./config";

export const localeSchema = z.enum(LOCALES);
export const themeSchema = z.enum([...THEMES, "system"]);
