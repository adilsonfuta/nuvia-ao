"use client";

import { FormEvent, useEffect, useState } from "react";
import { api } from "./api";

type Mode = "request" | "reset";

export default function PasswordRecoveryForm({ mode }: { mode: Mode }) {
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [devResetUrl, setDevResetUrl] = useState("");
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (mode === "reset") setToken(new URLSearchParams(window.location.search).get("token") || "");
  }, [mode]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setDevResetUrl("");
    if (mode === "reset" && password !== confirmation) {
      setError("As palavras-passe não coincidem.");
      return;
    }

    setLoading(true);
    try {
      if (mode === "request") {
        const result = await api<{ message: string; devResetUrl?: string }>(
          "/auth/password-reset/request",
          { method: "POST", body: JSON.stringify({ email }) },
        );
        setMessage(result.message);
        setDevResetUrl(result.devResetUrl || "");
      } else {
        const result = await api<{ message: string }>(
          "/auth/password-reset/reset",
          { method: "POST", body: JSON.stringify({ token, newPassword: password }) },
        );
        setMessage(result.message);
        setPassword("");
        setConfirmation("");
        setCompleted(true);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível concluir o pedido.");
    } finally {
      setLoading(false);
    }
  }

  const hasResetToken = mode !== "reset" || token.length > 0;

  return (
    <main className="auth-page">
      <a className="planner-back" href="/">← Nuvia</a>
      <section className="auth-card recovery-card">
        <p className="eyebrow">Acesso à conta</p>
        <h1>{mode === "request" ? "Recuperar palavra-passe" : "Escolher nova palavra-passe"}</h1>
        <p className="auth-copy">
          {mode === "request"
            ? "Indica o email da tua conta para receber instruções de recuperação."
            : "Cria uma palavra-passe com pelo menos 8 caracteres."}
        </p>

        {mode === "request" || (hasResetToken && !completed) ? (
          <form onSubmit={(event) => void submit(event)}>
            {mode === "request" ? (
              <label>
                Email da conta
                <input type="email" required maxLength={180} autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
              </label>
            ) : (
              <>
                <label>
                  Nova palavra-passe
                  <input type="password" required minLength={8} maxLength={128} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
                </label>
                <label>
                  Confirmar palavra-passe
                  <input type="password" required minLength={8} maxLength={128} autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
                </label>
              </>
            )}
            {error && <p className="form-error" role="alert">{error}</p>}
            {message && <p className="recovery-success" role="status">{message}</p>}
            {devResetUrl && (
              <a className="recovery-dev-link" href={devResetUrl}>
                Abrir link de recuperação (desenvolvimento) →
              </a>
            )}
            <button className="button button-primary" disabled={loading || (mode === "reset" && !token)}>
              {loading ? "A processar…" : mode === "request" ? "Enviar instruções" : "Guardar nova palavra-passe"}
            </button>
          </form>
        ) : completed ? (
          <p className="recovery-success" role="status">{message}</p>
        ) : (
          <div className="recovery-invalid-link" role="alert">
            <p>Este link está incompleto. Pede um novo link de recuperação.</p>
            <a href="/recuperar-senha">Pedir novo link →</a>
          </div>
        )}

        {mode === "reset" && completed ? (
          <p className="auth-switch"><a href="/entrar">Entrar com a nova palavra-passe</a></p>
        ) : (
          <p className="auth-switch">Já te lembraste? <a href="/entrar">Voltar a entrar</a></p>
        )}
      </section>
    </main>
  );
}
