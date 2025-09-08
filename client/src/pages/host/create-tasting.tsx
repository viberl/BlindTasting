import { useState } from "react";
import { useForm } from "react-hook-form";
import { useAuth } from "@/hooks/use-auth";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Wine } from "lucide-react";

// Validation schema
const createTastingSchema = z.object({
  name: z.string().min(3, "Name muss mindestens 3 Zeichen lang sein"),
  isPublic: z.boolean().default(true),
  password: z.string().optional(),
});

// Schema für Typ
type CreateTastingFormData = z.infer<typeof createTastingSchema>;

export default function CreateTastingPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [_, navigate] = useLocation();
  const [tastingType, setTastingType] = useState<"public" | "password" | "private">("public");
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitees, setInvitees] = useState<string[]>([]);

  const form = useForm<CreateTastingFormData>({
    resolver: zodResolver(createTastingSchema),
    defaultValues: {
      name: "",
      isPublic: true,
      password: "",
    },
  });

  const createTastingMutation = useMutation({
    mutationFn: async (data: CreateTastingFormData) => {
      if (!user || !user.id) {
        throw new Error("Sie müssen angemeldet sein, um eine Verkostung zu erstellen");
      }
      
      const requestData: any = {
        ...data,
        hostId: user.id,
      };
      
      // Wenn nicht passwortgeschützt, Passwort entfernen
      if (tastingType !== "password") {
        delete requestData.password;
      }
      
      // Öffentlichkeitsstatus festlegen
      requestData.isPublic = tastingType === "public";

      // Einladungen bei privater Verkostung anhängen
      if (tastingType === "private" && invitees.length > 0) {
        requestData.invitees = invitees;
      }
      
      console.log('Erstellen einer Verkostung mit:', { 
        ...requestData, 
        user: user ? 'Benutzer vorhanden' : 'Kein Benutzer',
        userId: user.id
      });
      
      // ENTWICKLUNGSMODUS: Wir überspringen die Authentifizierungsprüfung
      try {
        // Ein direkter Check für Entwicklungszwecke
        const checkAuth = await fetch('/api/direct-check', { credentials: 'include' });
        console.log('Direct check Status vor Verkostungserstellung:', checkAuth.status);
        
        if (checkAuth.status === 200) {
          console.log('Direct check erfolgreich');
        }
      } catch (error) {
        console.log('Direct check fehlgeschlagen, aber wir machen trotzdem weiter:', error);
      }
      
      // In der Entwicklung fahren wir direkt fort ohne Authentifizierungsprüfung
      const res = await apiRequest("POST", "/api/tastings", requestData);
      const result = await res.json();
      console.log('Verkostungserstellung Antwort:', result);
      return result;
    },
    onSuccess: (data) => {
      toast({
        title: "Verkostung erstellt",
        description: "Ihre Verkostung wurde erfolgreich erstellt",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/tastings"] });
      navigate(`/host/tasting/${data.id}`);
    },
    onError: (error: Error) => {
      toast({
        title: "Fehler",
        description: `Fehler beim Erstellen der Verkostung: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CreateTastingFormData) => {
    createTastingMutation.mutate(data);
  };

  const handleTastingTypeChange = (value: string) => {
    setTastingType(value as "public" | "password" | "private");
    
    // Reset password field when not using password protection
    if (value !== "password") {
      form.setValue("password", "");
    }
    
    // Update isPublic field based on type
    form.setValue("isPublic", value === "public");
  };

  return (
    <div className="container max-w-3xl mx-auto py-10 px-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Wine className="h-6 w-6 text-[#274E37]" />
            <CardTitle>Neue Verkostung erstellen</CardTitle>
          </div>
          <CardDescription>
            Erstellen Sie eine neue Blindverkostung und laden Sie Teilnehmer ein
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name der Verkostung</FormLabel>
                    <FormControl>
                      <Input placeholder="z.B. Bordeaux Blind Tasting" {...field} />
                    </FormControl>
                    <FormDescription>
                      Wählen Sie einen beschreibenden Namen für Ihre Verkostung
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-3">
                <FormLabel>Verkostungstyp</FormLabel>
                <Select
                  value={tastingType}
                  onValueChange={handleTastingTypeChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Wählen Sie einen Typ" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Öffentlich</SelectItem>
                    <SelectItem value="password">Passwortgeschützt</SelectItem>
              <SelectItem value="private">Nur mit Einladung</SelectItem>
              </SelectContent>
            </Select>
            <FormDescription>
                  {tastingType === "public" && "Jeder kann an dieser Verkostung teilnehmen"}
                  {tastingType === "password" && "Teilnehmer benötigen ein Passwort zum Beitreten"}
                  {tastingType === "private" && "Nur eingeladene Teilnehmer können beitreten"}
                </FormDescription>
              </div>

              {tastingType === "password" && (
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Passwort</FormLabel>
                      <FormControl>
                        <Input 
                          type="password" 
                          placeholder="Passwort für die Verkostung" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {tastingType === "private" && (
                <div className="space-y-3">
                  <FormLabel>Einladungen (E-Mail-Adressen)</FormLabel>
                  <div className="flex gap-2">
                    <Input 
                      placeholder="name@example.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const email = inviteEmail.trim().toLowerCase();
                          if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !invitees.includes(email)) {
                            setInvitees(prev => [...prev, email]);
                            setInviteEmail("");
                          }
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        const email = inviteEmail.trim().toLowerCase();
                        if (!email) return;
                        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                          toast({ title: 'Ungültige E-Mail', description: 'Bitte geben Sie eine gültige E-Mail ein.', variant: 'destructive' });
                          return;
                        }
                        if (!invitees.includes(email)) {
                          setInvitees(prev => [...prev, email]);
                          setInviteEmail("");
                        }
                      }}
                    >
                      Hinzufügen
                    </Button>
                  </div>
                  {invitees.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {invitees.map((email) => (
                        <span key={email} className="inline-flex items-center gap-2 bg-gray-100 text-gray-800 rounded-full px-3 py-1 text-sm">
                          {email}
                          <button
                            type="button"
                            className="text-gray-500 hover:text-gray-700"
                            onClick={() => setInvitees(prev => prev.filter(e => e !== email))}
                            aria-label={`Entferne ${email}`}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <FormDescription>
                    Eingeladene Nutzer sehen die Verkostung in der Startseite unter „Eingeladen“.
                  </FormDescription>
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full bg-[#274E37] hover:bg-[#e65b2d]"
                disabled={createTastingMutation.isPending}
              >
                {createTastingMutation.isPending ? "Wird erstellt..." : "Verkostung erstellen"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
