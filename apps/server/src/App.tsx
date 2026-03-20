import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import "./App.css";

type Status = {
  docker_running: boolean;
  containers: { name: string; status: string; running: boolean }[];
  healthy: boolean;
};

type Config = {
  domain: string;
  admin_email: string;
  admin_password: string;
};

function App() {
  const [phase, setPhase] = useState<"checking" | "no-docker" | "setup" | "running" | "stopped">("checking");
  const [step, setStep] = useState("");
  const [config, setConfig] = useState<Config | null>(null);
  const [pullProgress, setPullProgress] = useState({ index: 0, total: 6 });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkState();

    const unlisten1 = listen<string>("setup-step", (e) => setStep(e.payload));
    const unlisten2 = listen<{ index: number; total: number }>("pull-progress", (e) => setPullProgress(e.payload));

    return () => {
      unlisten1.then((f) => f());
      unlisten2.then((f) => f());
    };
  }, []);

  async function checkState() {
    try {
      const dockerOk = await invoke<boolean>("check_docker");
      if (!dockerOk) {
        setPhase("no-docker");
        return;
      }

      const status = await invoke<Status>("get_status");
      if (status.healthy) {
        const cfg = await invoke<Config>("get_config");
        setConfig(cfg);
        setPhase("running");
      } else if (status.containers.length > 0) {
        setPhase("stopped");
      } else {
        startSetup();
      }
    } catch {
      setPhase("no-docker");
    }
  }

  async function startSetup() {
    setPhase("setup");
    setError(null);
    try {
      const cfg = await invoke<Config>("start_instance");
      setConfig(cfg);
      setPhase("running");
    } catch (e) {
      setError(String(e));
    }
  }

  async function handleStart() {
    setPhase("setup");
    setStep("Starting containers...");
    try {
      const cfg = await invoke<Config>("start_instance");
      setConfig(cfg);
      setPhase("running");
    } catch (e) {
      setError(String(e));
    }
  }

  async function handleStop() {
    await invoke("stop_instance");
    setPhase("stopped");
  }

  if (phase === "no-docker") {
    return (
      <main className="container">
        <h1>Gratonite Server</h1>
        <div className="card">
          <h2>Docker Required</h2>
          <p>Gratonite Server needs Docker to run your instance.</p>
          <a href="https://docker.com/products/docker-desktop" target="_blank" className="btn">
            Download Docker Desktop
          </a>
          <button onClick={checkState} className="btn secondary">Check Again</button>
        </div>
      </main>
    );
  }

  if (phase === "checking" || phase === "setup") {
    return (
      <main className="container">
        <h1>Gratonite Server</h1>
        <div className="card">
          <div className="spinner" />
          <h2>{phase === "checking" ? "Checking..." : "Setting Up"}</h2>
          <p className="step">{step || "Preparing..."}</p>
          {phase === "setup" && (
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${(pullProgress.index / pullProgress.total) * 100}%` }} />
            </div>
          )}
          {error && <p className="error">{error}</p>}
        </div>
      </main>
    );
  }

  if (phase === "running" && config) {
    return (
      <main className="container">
        <h1>Gratonite Server</h1>
        <div className="card">
          <div className="status-row">
            <span className="dot green" />
            <h2>Running</h2>
          </div>
          <div className="info">
            <div className="row"><span className="label">URL</span><a href="https://localhost:8443" target="_blank">https://localhost:8443</a></div>
            <div className="row"><span className="label">Email</span><span>{config.admin_email}</span></div>
            <div className="row"><span className="label">Password</span><code>{config.admin_password}</code></div>
          </div>
          <p className="hint">Browser may show a security warning for the self-signed cert — click "Advanced" then "Proceed".</p>
          <div className="actions">
            <a href="https://localhost:8443" target="_blank" className="btn">Open Gratonite</a>
            <button onClick={handleStop} className="btn secondary">Stop</button>
          </div>
          <p className="federation">Federation active via relay.gratonite.chat</p>
        </div>
      </main>
    );
  }

  return (
    <main className="container">
      <h1>Gratonite Server</h1>
      <div className="card">
        <div className="status-row">
          <span className="dot red" />
          <h2>Stopped</h2>
        </div>
        <button onClick={handleStart} className="btn">Start</button>
      </div>
    </main>
  );
}

export default App;
