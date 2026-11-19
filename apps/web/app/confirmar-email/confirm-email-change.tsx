"use client";

import { useEffect, useState } from "react";
import { api } from "../lib/api";

export default function ConfirmEmailChange({ token }: { token: string }) {
  const [state, setState] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("A confirmar o novo endereço de email…");

  useEffect(() => {
    if (!token) {
      setState("error");
      setMessage("O link de confirmação está incompleto. Inicia novamente a alteração do email na dashboard.");
      return;
    }
    void api<{ message: string }>("/auth/email-change/confirm", {
      method: "POST",
      body: JSON.stringify({ token }),
    }).then((result) => {
      setState("success");
      setMessage(result.message);
    }).catch((error) => {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Não foi possível confirmar este email.");
    });
  }, [token]);

  return (
    <main className="auth-page">
      <a className="planner-back" href="/">← Nuvia</a>
      <section className="auth-card email-confirm-card" aria-live="polite">
        <p className="eyebrow">Segurança da conta</p>
        <h1>{state === "loading" ? "A confirmar email" : state === "success" ? "Email confirmado" : "Não foi possível confirmar"}</h1>
        <p className="auth-copy">{message}</p>
        {state === "loading" && <span className="app-loading-mark" aria-hidden="true" />}
        {state === "success" && <a className="button button-primary" href="/entrar">Entrar com o novo email</a>}
        {state === "error" && <a className="button button-outline" href="/entrar">Voltar a entrar</a>}
      </section>
    </main>
  );
}
