"use client";

import { useEffect, useState } from "react";
import { api } from "../lib/api";

export default function ConfirmAccountEmail({ token }: { token: string }) {
  const [state, setState] = useState<"ready" | "submitting" | "success" | "error">("ready");
  const [message, setMessage] = useState("Confirma que este endereço te pertence para concluir a validação da conta.");

  useEffect(() => {
    if (!token) {
      setState("error");
      setMessage("O link está incompleto. Entra na tua conta e pede um novo email de confirmação.");
    }
  }, [token]);

  async function confirm() {
    if (!token || state === "submitting") return;
    setState("submitting");
    try {
      const result = await api<{ message: string }>("/auth/email-verification/confirm", {
      method: "POST",
      body: JSON.stringify({ token }),
      });
      setState("success");
      setMessage(result.message);
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Não foi possível confirmar este endereço.");
    }
  }

  return (
    <main className="auth-page">
      <a className="planner-back" href="/">← Nuvia</a>
      <section className="auth-card email-confirm-card" aria-live="polite">
        <p className="eyebrow">Segurança da conta</p>
        <h1>{state === "submitting" ? "A confirmar email" : state === "success" ? "Email confirmado" : state === "error" ? "Não foi possível confirmar" : "Confirma o teu email"}</h1>
        <p className="auth-copy">{message}</p>
        {state === "ready" && <><p className="auth-copy">Este link é válido durante 24 horas e só pode ser utilizado uma vez.</p><button className="button button-primary" type="button" onClick={() => void confirm()}>Confirmar endereço</button></>}
        {state === "submitting" && <span className="app-loading-mark" aria-hidden="true" />}
        {state === "success" && <a className="button button-primary" href="/dashboard">Continuar para a Nuvia</a>}
        {state === "error" && <a className="button button-outline" href="/entrar">Voltar a entrar</a>}
      </section>
    </main>
  );
}
