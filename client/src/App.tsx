import { Switch, Route } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/home-page";
import AuthPage from "@/pages/auth-page";
import JoinPage from "@/pages/taster/join";
import WaitingPage from "@/pages/taster/waiting";
import CreateTastingPage from "@/pages/host/create-tasting";
import { ProtectedRoute } from "./lib/protected-route";
import Navbar from "@/components/layout/navbar";
import Footer from "@/components/layout/footer";
import { AuthProvider } from "./hooks/use-auth";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Create a client
const queryClient = new QueryClient();

import TastingDetailPage from "@/pages/host/tasting-detail";
import SubmitGuesses from "@/pages/taster/submit-guesses";
import ProfilePage from "@/pages/profile";

function Router() {
  return (
    <Switch>
      <ProtectedRoute path="/" component={HomePage} />
      <ProtectedRoute path="/host/create-tasting" component={CreateTastingPage} />
      <ProtectedRoute path="/host/tasting/:id" component={TastingDetailPage} />
      <ProtectedRoute path="/tasting/:id/submit" component={SubmitGuesses} />
      <ProtectedRoute path="/profile" component={ProfilePage} />
      <ProtectedRoute path="/taster/join/:id" component={JoinPage} />
      <ProtectedRoute path="/taster/waiting/:id" component={WaitingPage} />
      <Route path="/auth" component={AuthPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // Log für Debugging-Zwecke
  console.log("App wird geladen. API-Basis-URL:", window.location.origin);
  
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <div className="flex flex-col min-h-screen">
          <Navbar />
          <div className="flex-grow">
            <Router />
          </div>
          <Footer />
          <Toaster />
        </div>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
