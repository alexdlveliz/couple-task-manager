import { useState, type SyntheticEvent } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, authReady } from "./auth";

export function SignIn({ notice = "" }: { notice?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await authReady;
      await signInWithEmailAndPassword(auth, email, password);
    } catch {
      setError("No se pudo iniciar sesión. Revisa tus datos.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main>
      <h1>Iniciar sesión</h1>
      <p>
        Este tablero es privado para dos personas. Usa la cuenta que se te
        proporcionó.
      </p>
      <form
        onSubmit={(event) => {
          void submit(event);
        }}
      >
        <label>
          Correo electrónico{" "}
          <input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
            }}
          />
        </label>
        <label>
          Contraseña{" "}
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
            }}
          />
        </label>
        {(error || notice) && <p role="alert">{error || notice}</p>}
        <button disabled={busy} type="submit">
          Entrar
        </button>
      </form>
    </main>
  );
}
