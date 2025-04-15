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
      const requestData = {
        ...data,
        hostId: user?.id,
      };
      
      // Wenn nicht passwortgeschützt, Passwort entfernen
      if (tastingType !== "password") {
        delete requestData.password;
      }
      
      // Öffentlichkeitsstatus festlegen
      requestData.isPublic = tastingType === "public";
      
      console.log('Erstellen einer Verkostung mit:', { 
        ...requestData, 
        user: user ? 'Benutzer vorhanden' : 'Kein Benutzer',
        userId: user?.id
      });
      
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
            <Wine className="h-6 w-6 text-[#4C0519]" />
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

              <Button 
                type="submit" 
                className="w-full bg-[#4C0519] hover:bg-[#3A0413]"
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