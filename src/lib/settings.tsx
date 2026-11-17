"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Ctx = {
  besar: boolean;
  gelap: boolean;
  setBesar: (v: boolean) => void;
  setGelap: (v: boolean) => void;
};

const SettingsContext = createContext<Ctx | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [besar, setBesarState] = useState(false);
  const [gelap, setGelapState] = useState(false);

  useEffect(() => {
    setBesarState(document.documentElement.dataset.besar === "true");
    setGelapState(document.documentElement.dataset.tema === "gelap");
  }, []);

  const simpan = (k: string, v: boolean) => {
    try { localStorage.setItem(k, String(v)); } catch { /* abaikan */ }
  };

  const setBesar = (v: boolean) => {
    setBesarState(v);
    document.documentElement.dataset.besar = String(v);
    simpan("besar", v);
  };
  const setGelap = (v: boolean) => {
    setGelapState(v);
    document.documentElement.dataset.tema = v ? "gelap" : "terang";
    simpan("gelap", v);
  };

  return (
    <SettingsContext.Provider value={{ besar, gelap, setBesar, setGelap }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings harus di dalam SettingsProvider");
  return ctx;
}

/** Dijalankan sebelum halaman tampil, supaya tidak berkedip. */
export const SKRIP_TEMA = `(function(){try{var d=document.documentElement;
d.dataset.besar=localStorage.getItem('besar')==='true'?'true':'false';
d.dataset.tema=localStorage.getItem('gelap')==='true'?'gelap':'terang';}catch(e){}})();`;
