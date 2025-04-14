import { Switch, Route } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/home-page";
import AuthPage from "@/pages/auth-page";
import { ProtectedRoute } from "./lib/protected-route";
import CreateTasting from "@/pages/host/create-tasting";
import ScoringSetup from "@/pages/host/scoring-setup";
import WinesSetup from "@/pages/host/wines-setup";
import Summary from "@/pages/host/summary";
import HostDashboard from "@/pages/host/dashboard";
import TastingDetails from "@/pages/taster/tasting-details";
import SubmitGuesses from "@/pages/taster/submit-guesses";
import Navbar from "@/components/layout/navbar";
import Footer from "@/components/layout/footer";

function Router() {
  return (
    <Switch>
      <ProtectedRoute path="/" component={HomePage} />
      <Route path="/auth" component={AuthPage} />
      <ProtectedRoute path="/host/create" component={CreateTasting} />
      <ProtectedRoute path="/host/scoring/:id" component={ScoringSetup} />
      <ProtectedRoute path="/host/wines/:id" component={WinesSetup} />
      <ProtectedRoute path="/host/summary/:id" component={Summary} />
      <ProtectedRoute path="/host/dashboard/:id" component={HostDashboard} />
      <ProtectedRoute path="/tasting/:id" component={TastingDetails} />
      <ProtectedRoute path="/tasting/:id/submit" component={SubmitGuesses} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <div className="flex-grow">
        <Router />
      </div>
      <Footer />
      <Toaster />
    </div>
  );
}

export default App;
