import { Switch, Route } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/home-page";
import AuthPage from "@/pages/auth-page";
import CreateTastingPage from "@/pages/host/create-tasting";
import { ProtectedRoute } from "./lib/protected-route";
import Navbar from "@/components/layout/navbar";
import Footer from "@/components/layout/footer";
import { AuthProvider } from "./hooks/use-auth";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Create a client
const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <ProtectedRoute path="/" component={HomePage} />
      <ProtectedRoute path="/host/create-tasting" component={CreateTastingPage} />
      <Route path="/auth" component={AuthPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

import HostDashboard from "@/pages/host/dashboard";
import CreateTasting from "@/pages/host/create";
import ScoringSetup from "@/pages/host/scoring-setup";
import WinesSetup from "@/pages/host/wines-setup";
import TastingSummary from "@/pages/host/tasting-summary";
import TastingDetails from "@/pages/tasting-details";
import SubmitGuesses from "@/pages/submit-guesses";


function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <div className="min-h-screen flex flex-col">
          <Navbar />
          <div className="flex-1">
            <Router>
              <Switch>
                <Route path="/" component={HomePage} />
                <Route path="/auth" component={AuthPage} />
                <ProtectedRoute path="/host/dashboard" component={HostDashboard} />
                <ProtectedRoute path="/host/create" component={CreateTasting} />
                <ProtectedRoute path="/host/scoring/:id" component={ScoringSetup} />
                <ProtectedRoute path="/host/wines/:id" component={WinesSetup} />
                <ProtectedRoute path="/host/summary/:id" component={TastingSummary} />
                <ProtectedRoute path="/tasting/:id" component={TastingDetails} />
                <ProtectedRoute path="/tasting/:id/guess" component={SubmitGuesses} />
                <Route component={NotFound} />
              </Switch>
            </Router>
          </div>
          <Footer />
          <Toaster/>
        </div>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;