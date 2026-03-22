import { DockerIcon, MonitorIcon, MessageSquareIcon } from "./icons";

export function DockerExplainer() {
  return (
    <div className="neo-border-2 rounded-xl p-5 bg-surface/50 mt-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-blue-light/20 flex items-center justify-center">
          <DockerIcon size={20} className="text-blue-light" />
        </div>
        <div>
          <h4 className="font-display font-bold text-foreground text-sm">What is Docker?</h4>
          <p className="text-foreground/50 text-xs">A quick intro, no experience needed</p>
        </div>
      </div>

      <div className="space-y-3 text-foreground/70 text-sm leading-relaxed">
        <p>
          Gratonite needs a few things to run: a database to store messages, a web server to handle connections, and more. Instead of installing each of these separately, Docker bundles them all together into a single package called a{" "}
          <span className="font-semibold text-blue-light">container</span>.
        </p>
        <p>
          A container is like a mini computer inside your computer. It has everything Gratonite needs, neatly organized and isolated from the rest of your system. Nothing leaks out, nothing conflicts with your other apps.
        </p>
        <p>
          Docker is a free app that makes containers work. Millions of developers use it every day. To host Gratonite, you just need to install Docker once and the Gratonite Server App takes care of the rest.
        </p>
      </div>

      <div className="mt-5 rounded-lg bg-charcoal/5 dark:bg-charcoal/30 p-4" aria-hidden="true">
        <p className="text-xs font-bold uppercase tracking-wider text-foreground/40 mb-3 text-center">How it works</p>
        <div className="flex items-center justify-center gap-3 sm:gap-5">
          <div className="text-center">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl neo-border-2 bg-surface flex items-center justify-center mx-auto mb-1.5">
              <MonitorIcon size={22} className="text-foreground/60" />
            </div>
            <span className="text-[10px] sm:text-xs text-foreground/50">Your Computer</span>
          </div>
          <span className="text-foreground/30 text-xs">runs</span>
          <div className="text-center">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl neo-border-2 bg-blue-light/10 flex items-center justify-center mx-auto mb-1.5">
              <DockerIcon size={22} className="text-blue-light" />
            </div>
            <span className="text-[10px] sm:text-xs text-blue-light">Docker</span>
          </div>
          <span className="text-foreground/30 text-xs">runs</span>
          <div className="text-center">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl neo-border-2 bg-purple/10 flex items-center justify-center mx-auto mb-1.5">
              <MessageSquareIcon size={22} className="text-purple" />
            </div>
            <span className="text-[10px] sm:text-xs text-purple">Gratonite</span>
          </div>
        </div>
        <p className="text-center text-foreground/40 text-xs mt-3">Everything stays clean and organized.</p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <a
          href="https://docker.com/products/docker-desktop"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-blue-light text-white px-4 py-2 rounded-lg text-xs font-bold neo-shadow-sm hover:translate-y-[-1px] transition-transform"
        >
          Download Docker Desktop
        </a>
        <span className="text-foreground/40 text-xs">Free for personal use. Available on macOS, Windows, and Linux.</span>
      </div>
    </div>
  );
}
