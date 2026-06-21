import { createClient } from '@supabase/supabase-js';

const sanitizeEnvVar = (v: string | undefined): string => {
  if (!v) return "";
  let s = v.trim();
  // Remove wrapping single or double quotes
  while ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  return s;
};

const sanitizeUrl = (url: string | undefined): string => {
  let s = sanitizeEnvVar(url);
  if (!s) return "";
  
  // Remove all trailing slashes
  while (s.endsWith("/")) {
    s = s.slice(0, -1).trim();
  }
  
  // Remove accidental /rest/v1 or /rest paths pasted by users
  if (s.endsWith("/rest/v1")) {
    s = s.substring(0, s.length - 8).trim();
  } else if (s.endsWith("/rest")) {
    s = s.substring(0, s.length - 5).trim();
  }
  
  while (s.endsWith("/")) {
    s = s.slice(0, -1).trim();
  }
  
  // Clean up any carriage returns, newlines or hidden tabs
  s = s.replace(/[\r\n\t]/g, "").trim();
  return s;
};

const sanitizeKey = (key: string | undefined): string => {
  let s = sanitizeEnvVar(key);
  if (!s) return "";
  s = s.replace(/[\r\n\t]/g, "").trim();
  return s;
};

const rxUrl = (import.meta as any).env.VITE_SUPABASE_URL || 'https://zlrnlxlilxcgkrdiyyzp.supabase.co';
const rxKey = (import.meta as any).env.VITE_SUPABASE_PUBLIC_ANON_KEY || (import.meta as any).env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpscm5seGxpbHhjZ2tyZGl5eXpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5Nzk3NjksImV4cCI6MjA5NzU1NTc2OX0.Ft-KrM00cLk88beVTaEwDm2Cp-5AaGPeKqHUcumgcl8';

export const supabaseUrl = sanitizeUrl(rxUrl);
export const supabaseAnonKey = sanitizeKey(rxKey);

if (!(import.meta as any).env.VITE_SUPABASE_URL || !(import.meta as any).env.VITE_SUPABASE_PUBLIC_ANON_KEY) {
  console.log("Variáveis de ambiente ausentes no AI Studio. Usando as credenciais fornecidas pelo usuário como fallback padrão.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

