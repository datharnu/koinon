import { lazy, Suspense } from "react";
import { Route, Switch } from "wouter";
import { NotFound } from "./pages/NotFound";
import { Spinner } from "./ui/button";

const Home = lazy(() => import("./pages/Home").then((mod) => ({ default: mod.Home })));
const Demo = lazy(() => import("./pages/Demo"));
const MemberView = lazy(() => import("./pages/MemberView"));
const Cosign = lazy(() => import("./pages/Cosign"));

export function App() {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-dvh place-items-center text-ink-3">
          <Spinner size={22} />
        </div>
      }
    >
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/app" component={Demo} />
        <Route path="/fonds/:id">{(params) => <MemberView fundId={params.id} />}</Route>
        <Route path="/cosign" component={Cosign} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}
